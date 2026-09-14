"""Authentication and tenant context shared by API modules (ticket #22)."""
import hashlib
import os
import re
import secrets
import smtplib
import ssl
import time
from datetime import timedelta, timezone
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
from urllib.parse import urlencode

import click

from flask import Blueprint, current_app, g, jsonify, request
from flask_jwt_extended import JWTManager, create_access_token, get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import delete, select, update, inspect
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from api.models import db, User, Company, CompanyMembership, PasswordResetToken, AuthSession, AuthRateLimit, utc_now


auth = Blueprint('auth', __name__)
GENERIC_RESET = 'Si la cuenta existe, recibirás instrucciones para restablecer la contraseña.'
DUMMY_HASH = generate_password_hash('constant-timing-placeholder')



def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def error(message, status):
    return jsonify(message=message), status


def payload():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def email_value(data):
    value = data.get('email')
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if len(value) <= 255 and re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value) else None


def password_valid(value):
    return isinstance(value, str) and 12 <= len(value) <= 128


def set_password(user, password):
    if not password_valid(password):
        raise ValueError('La contraseña debe tener entre 12 y 128 caracteres.')
    user.password_hash = generate_password_hash(password)


def limited(scope, maximum=10, window=900):
    def decorate(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if current_app.config.get('AUTH_RATE_LIMIT_ENABLED', True):
                now = int(time.time())
                bucket = now // window
                # Never trust client-provided X-Forwarded-For here.
                keys = [f'{scope}:ip:{request.remote_addr}']
                email = email_value(payload())
                if email:
                    keys.append(f'{scope}:email:{email}')
                for value in keys:
                    key = digest(f'{value}:{bucket}')
                    db.session.execute(delete(AuthRateLimit).where(AuthRateLimit.expires_at <= now))
                    updated = db.session.execute(update(AuthRateLimit).where(
                        AuthRateLimit.key == key).values(count=AuthRateLimit.count + 1))
                    if not updated.rowcount:
                        try:
                            with db.session.begin_nested():
                                db.session.add(AuthRateLimit(key=key, count=1, expires_at=(bucket + 1) * window))
                                db.session.flush()
                        except IntegrityError:
                            db.session.execute(update(AuthRateLimit).where(
                                AuthRateLimit.key == key).values(count=AuthRateLimit.count + 1))
                    db.session.commit()
                    count = db.session.get(AuthRateLimit, key).count
                    if count > maximum:
                        response = jsonify(message='Demasiados intentos. Inténtalo más tarde.')
                        response.status_code = 429
                        response.headers['Retry-After'] = str((bucket + 1) * window - now)
                        return response
            return fn(*args, **kwargs)
        return wrapped
    return decorate


def tenant_required(fn):
    """Require JWT plus a verified membership selected by X-Company-ID."""
    @wraps(fn)
    @jwt_required()
    def wrapped(*args, **kwargs):
        raw = request.headers.get('X-Company-ID', '')
        if not raw.isascii() or not raw.isdecimal() or len(raw) > 10:
            return error('Indica una empresa válida en X-Company-ID.', 400)
        membership = db.session.scalar(select(CompanyMembership).join(Company).where(
            CompanyMembership.company_id == int(raw),
            CompanyMembership.user_id == int(get_jwt_identity()),
            Company.is_active.is_(True)))
        if membership is None:
            return error('No tienes acceso a esta empresa.', 403)
        g.company_id = membership.company_id
        g.membership = membership
        g.user = db.session.get(User, int(get_jwt_identity()))
        return fn(*args, **kwargs)
    return wrapped


def init_auth(app):
    app.config.setdefault('JWT_SECRET_KEY', os.getenv('JWT_SECRET_KEY'))
    if not app.config['JWT_SECRET_KEY'] or len(app.config['JWT_SECRET_KEY']) < 32:
        raise RuntimeError('Set JWT_SECRET_KEY to a random secret of at least 32 characters.')
    app.config.setdefault('JWT_ACCESS_TOKEN_EXPIRES', timedelta(minutes=30))
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config.setdefault('AUTH_RESET_URL', os.getenv('AUTH_RESET_URL', 'http://localhost:3000/reset-password'))
    app.config.setdefault('AUTH_RESET_OUTBOX', os.getenv('AUTH_RESET_OUTBOX'))
    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def revoked(header, claims):
        identity = claims.get('sub')
        if not isinstance(identity, str) or not identity.isdecimal():
            return True
        session = db.session.get(AuthSession, claims.get('sid', ''))
        user = db.session.get(User, int(identity))
        return (session is None or session.revoked_at is not None or user is None
                or not user.is_active or session.user_id != user.id
                or session.expires_at.replace(tzinfo=timezone.utc) <= utc_now())

    @jwt.unauthorized_loader
    def missing(reason):
        return error('Autenticación requerida.', 401)

    @jwt.invalid_token_loader
    def invalid(reason):
        return error('Sesión inválida.', 401)

    @jwt.expired_token_loader
    def expired(header, claims):
        return error('Sesión caducada.', 401)

    @jwt.revoked_token_loader
    def blocked(header, claims):
        return error('Sesión inválida.', 401)

    @app.after_request
    def no_auth_cache(response):
        if request.blueprint == 'auth':
            response.headers['Cache-Control'] = 'no-store'
        return response

    app.register_blueprint(auth, url_prefix='/api')

    @app.cli.command('auth-local-bootstrap')
    @click.option('--email', prompt=True)
    @click.password_option(confirmation_prompt=True)
    def bootstrap(email, password):
        """Create an EMPTY, disposable local database and its first test owner."""
        if not app.debug or os.getenv('AUTH_ALLOW_LOCAL_BOOTSTRAP') != '1':
            raise click.ClickException('Requires FLASK_DEBUG=1 and AUTH_ALLOW_LOCAL_BOOTSTRAP=1.')
        if inspect(db.engine).get_table_names():
            raise click.ClickException('Database must be empty; existing data was not changed.')
        normalized = email_value({'email': email})
        if not normalized or not password_valid(password):
            raise click.ClickException('Use a valid email and a password of 12–128 characters.')
        user = User(email=normalized, first_name='Local', last_name='Owner')
        set_password(user, password)
        company = Company(name='Local test company', slug='local-test')
        db.create_all()
        db.session.add_all([user, company])
        db.session.flush()
        from api.models import MembershipRole
        db.session.add(CompanyMembership(user_id=user.id, company_id=company.id, role=MembershipRole.OWNER))
        db.session.commit()
        click.echo('Local owner created. This is not a migration or a deployment procedure.')


@auth.post('/login')
@limited('login')
def login():
    data = payload()
    email, password = email_value(data), data.get('password')
    if not email or not isinstance(password, str) or not 1 <= len(password) <= 128:
        return error('Introduce un email y una contraseña válidos.', 400)
    user = db.session.scalar(select(User).where(db.func.lower(User.email) == email))
    matches = check_password_hash(user.password_hash if user else DUMMY_HASH, password)
    if not user or not matches or not user.is_active:
        return error('Credenciales inválidas.', 401)
    # Serializes session creation with password reset, preventing stale logins.
    user = db.session.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    if not user.is_active or not check_password_hash(user.password_hash, password):
        return error('Credenciales inválidas.', 401)
    sid = secrets.token_hex(32)
    duration = current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
    session = AuthSession(id=sid, user_id=user.id, expires_at=utc_now() + duration)
    db.session.add(session)
    user.last_login_at = utc_now()
    token = create_access_token(identity=str(user.id), additional_claims={'sid': sid})
    db.session.commit()
    return jsonify(token=token, token_type='Bearer', expires_in=int(duration.total_seconds()), user=user.serialize())


@auth.get('/me')
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    memberships = db.session.scalars(select(CompanyMembership).join(Company).where(
        CompanyMembership.user_id == user.id, Company.is_active.is_(True))).all()
    return jsonify(user=user.serialize(), companies=[{
        'id': m.company_id, 'name': m.company.name, 'membership_id': m.id,
        'role': m.role.value} for m in memberships])


@auth.get('/auth/context')
@tenant_required
def context():
    return jsonify(user=g.user.serialize(), company_id=g.company_id,
                   membership_id=g.membership.id, role=g.membership.role.value)


@auth.post('/logout')
@jwt_required()
def logout():
    session = db.session.get(AuthSession, get_jwt()['sid'])
    session.revoked_at = utc_now()
    db.session.commit()
    return '', 204


def delivery_available():
    return (current_app.config.get('AUTH_RESET_SENDER') is not None
            or (current_app.debug and current_app.config.get('AUTH_RESET_OUTBOX'))
            or (os.getenv('SMTP_HOST') and os.getenv('SMTP_FROM')))


def deliver_reset(email, token):
    link = current_app.config['AUTH_RESET_URL'] + '?' + urlencode({'token': token})
    sender = current_app.config.get('AUTH_RESET_SENDER')
    if sender:
        sender(email, link)
        return
    if current_app.debug and current_app.config.get('AUTH_RESET_OUTBOX'):
        folder = Path(current_app.config['AUTH_RESET_OUTBOX'])
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        file = folder / (secrets.token_hex(16) + '.txt')
        fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as out:
            out.write(f'To: {email}\n\n{link}\n')
        return
    message = EmailMessage()
    message['From'] = os.environ['SMTP_FROM']
    message['To'] = email
    message['Subject'] = 'Restablecer contraseña — ClientFlow'
    message.set_content(f'Abre este enlace para cambiar tu contraseña (válido 30 minutos):\n{link}')
    with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT', '587')), timeout=10) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        if os.getenv('SMTP_USER'):
            smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(message)


@auth.post('/forgot-password')
@limited('forgot', maximum=5)
def forgot_password():
    email = email_value(payload())
    if not email:
        return error('Introduce un email válido.', 400)
    if not delivery_available():
        return error('Recuperación no disponible temporalmente.', 503)
    user = db.session.scalar(select(User).where(db.func.lower(User.email) == email))
    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        record = PasswordResetToken(user_id=user.id, token_hash=digest(token), expires_at=utc_now() + timedelta(minutes=30))
        db.session.add(record)
        db.session.commit()
        try:
            deliver_reset(email, token)
        except Exception:
            # Same public response even on delivery failures: no account disclosure.
            record.used_at = utc_now()
            db.session.commit()
            current_app.logger.error('Password reset delivery failed; token invalidated.')
    return jsonify(message=GENERIC_RESET), 202


@auth.post('/reset-password')
@limited('reset')
def reset_password():
    data = payload()
    token, password = data.get('token'), data.get('password')
    if not isinstance(token, str) or not 1 <= len(token) <= 256 or not password_valid(password):
        return error('Enlace inválido o contraseña fuera del rango de 12 a 128 caracteres.', 400)
    if data.get('password_confirmation') != password:
        return error('La confirmación de contraseña no coincide.', 400)
    record = db.session.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == digest(token)))
    if record is None:
        return error('Enlace inválido o caducado.', 400)
    user = db.session.scalar(select(User).where(User.id == record.user_id).with_for_update())
    if user is None or not user.is_active:
        return error('Enlace inválido o caducado.', 400)
    now = utc_now()
    consumed = db.session.execute(update(PasswordResetToken).where(
        PasswordResetToken.id == record.id, PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now).values(used_at=now).execution_options(synchronize_session="fetch"))
    if consumed.rowcount != 1:
        db.session.rollback()
        return error('Enlace inválido o caducado.', 400)
    set_password(user, password)
    db.session.execute(update(PasswordResetToken).where(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)).values(used_at=now))
    db.session.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked_at=now))
    db.session.commit()
    return jsonify(message='Contraseña actualizada. Inicia sesión de nuevo.')
