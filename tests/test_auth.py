import os
import sys
import unittest
from datetime import timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from flask import Flask
from sqlalchemy import select
from api.models import db, User, Company, CompanyMembership, MembershipRole, PasswordResetToken, utc_now
from api.auth import init_auth, set_password, AuthSession


class AuthenticationTest(unittest.TestCase):
    def setUp(self):
        self.sent = []
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI=os.getenv('AUTH_TEST_DATABASE_URL', 'sqlite://'),
                               JWT_SECRET_KEY='test-secret-' * 8,
                               AUTH_RATE_LIMIT_ENABLED=False,
                               AUTH_RESET_SENDER=lambda email, link: self.sent.append((email, link)))
        db.init_app(self.app)
        init_auth(self.app)
        self.ctx = self.app.app_context()
        self.ctx.push()
        # AUTH_TEST_DATABASE_URL must point to a disposable database.
        db.create_all()
        self.user = User(email='owner@example.com', first_name='Owner', last_name='Test')
        set_password(self.user, 'initial-password-123')
        company = Company(name='Own', slug='own')
        other = Company(name='Other', slug='other')
        db.session.add_all([self.user, company, other])
        db.session.flush()
        db.session.add(CompanyMembership(user_id=self.user.id, company_id=company.id, role=MembershipRole.OWNER))
        db.session.commit()
        self.company_id, self.other_id = company.id, other.id
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.ctx.pop()

    def login(self, **changes):
        data = {'email': 'owner@example.com', 'password': 'initial-password-123'}
        data.update(changes)
        return self.client.post('/api/login', json=data)

    def headers(self):
        return {'Authorization': 'Bearer ' + self.login().json['token']}

    def reset_token(self):
        response = self.client.post('/api/forgot-password', json={'email': self.user.email})
        self.assertEqual(response.status_code, 202)
        return parse_qs(urlparse(self.sent[-1][1]).query)['token'][0]

    def reset(self, token, **changes):
        data = dict(token=token, password='new-password-456', password_confirmation='new-password-456')
        data.update(changes)
        return self.client.post('/api/reset-password', json=data)

    def test_login_me_and_context(self):
        response = self.login(email=' OWNER@EXAMPLE.COM ')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('password_hash', response.json['user'])
        headers = {'Authorization': 'Bearer ' + response.json['token']}
        self.assertEqual(self.client.get('/api/me', headers=headers).json['companies'][0]['id'], self.company_id)
        headers['X-Company-ID'] = str(self.company_id)
        response = self.client.get('/api/auth/context', headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['role'], 'owner')

    def test_cross_company_denied(self):
        headers = self.headers()
        for company in [self.other_id, 9999]:
            headers['X-Company-ID'] = str(company)
            self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 403)
        for value in ['', 'abc', '-1']:
            headers['X-Company-ID'] = value
            self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 400)

    def test_membership_and_company_rechecked(self):
        headers = self.headers() | {'X-Company-ID': str(self.company_id)}
        db.session.get(Company, self.company_id).is_active = False
        db.session.commit()
        self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 403)
        db.session.get(Company, self.company_id).is_active = True
        db.session.delete(db.session.scalar(select(CompanyMembership)))
        db.session.commit()
        self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 403)

    def test_logout_revokes_persistently(self):
        headers = self.headers()
        self.assertEqual(self.client.post('/api/logout', headers=headers).status_code, 204)
        db.session.remove()
        self.assertEqual(self.client.get('/api/me', headers=headers).status_code, 401)

    def test_inactive_user_and_generic_credentials(self):
        missing = self.login(email='missing@example.com')
        wrong = self.login(password='wrong')
        self.assertEqual(missing.json, wrong.json)
        headers = self.headers()
        self.user.is_active = False
        db.session.commit()
        self.assertEqual(self.login().json, wrong.json)
        self.assertEqual(self.client.get('/api/me', headers=headers).status_code, 401)

    def test_missing_invalid_and_expired_jwt(self):
        self.assertEqual(self.client.get('/api/me').status_code, 401)
        self.assertEqual(self.client.get('/api/me', headers={'Authorization': 'Bearer broken'}).status_code, 401)
        self.app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=-1)
        self.assertEqual(self.client.get('/api/me', headers=self.headers()).status_code, 401)

    def test_malformed_login(self):
        for data in [[], None, {'email': 1}, {'email': 'bad', 'password': 'x'}, {'email': self.user.email, 'password': ''}]:
            self.assertEqual(self.client.post('/api/login', json=data).status_code, 400)

    def test_reset_end_to_end_revokes_sessions_and_sibling_tokens(self):
        headers = self.headers()
        token = self.reset_token()
        sibling = self.reset_token()
        record = db.session.scalar(select(PasswordResetToken))
        self.assertNotEqual(record.token_hash, token)
        self.assertEqual(self.reset(token).status_code, 200)
        self.assertEqual(self.reset(token).status_code, 400)
        self.assertEqual(self.reset(sibling).status_code, 400)
        self.assertEqual(self.login().status_code, 401)
        self.assertEqual(self.login(password='new-password-456').status_code, 200)
        self.assertEqual(self.client.get('/api/me', headers=headers).status_code, 401)
        self.assertNotEqual(self.user.password_hash, 'new-password-456')

    def test_expired_reset(self):
        token = self.reset_token()
        db.session.scalar(select(PasswordResetToken)).expires_at = utc_now() - timedelta(seconds=1)
        db.session.commit()
        self.assertEqual(self.reset(token).status_code, 400)

    def test_reset_validation_does_not_consume_token(self):
        token = self.reset_token()
        self.assertEqual(self.reset(token, password_confirmation='different').status_code, 400)
        self.assertEqual(self.reset(token, password='short', password_confirmation='short').status_code, 400)
        self.assertEqual(self.reset('invented-token').status_code, 400)
        self.assertEqual(self.reset(token).status_code, 200)

    def test_reset_generic_and_no_token_leak(self):
        response = self.client.post('/api/forgot-password', json={'email': self.user.email})
        unknown = self.client.post('/api/forgot-password', json={'email': 'missing@example.com'})
        self.assertEqual(response.json, unknown.json)
        self.assertEqual(response.status_code, unknown.status_code)
        self.assertEqual(set(response.json), {'message'})
        self.assertEqual(len(self.sent), 1)

    def test_delivery_failure_invalidates_token(self):
        def fail(email, link):
            raise OSError('private provider details')
        self.app.config['AUTH_RESET_SENDER'] = fail
        response = self.client.post('/api/forgot-password', json={'email': self.user.email})
        self.assertEqual(response.status_code, 202)
        self.assertIsNotNone(db.session.scalar(select(PasswordResetToken)).used_at)
        self.assertNotIn('private', response.get_data(as_text=True))

    def test_rate_limit_is_persistent(self):
        self.app.config['AUTH_RATE_LIMIT_ENABLED'] = True
        for _ in range(10):
            self.assertEqual(self.login(password='wrong').status_code, 401)
        db.session.remove()
        response = self.login()
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response.headers['Retry-After']), 0)

    def test_session_expiry_preserves_timezone_instant(self):
        headers = self.headers()
        session = db.session.scalar(select(AuthSession))
        # Retain aware values in the identity map: SQLite strips offsets on read.
        # These are the values PostgreSQL can return in a non-UTC session.
        for offset in (-5, 0, 5.5):
            for minutes, expected in ((29, 200), (-1, 401)):
                with self.subTest(offset=offset, minutes=minutes):
                    session.expires_at = (utc_now() + timedelta(minutes=minutes)).astimezone(
                        timezone(timedelta(hours=offset)))
                    response = self.client.get('/api/me', headers=headers)
                    self.assertEqual(response.status_code, expected)
        for minutes, expected in ((29, 200), (-1, 401)):
            with self.subTest(naive_utc=True, minutes=minutes):
                session.expires_at = (utc_now() + timedelta(minutes=minutes)).replace(tzinfo=None)
                self.assertEqual(self.client.get('/api/me', headers=headers).status_code, expected)

    def test_logout_only_revokes_current_session(self):
        first, second = self.headers(), self.headers()
        self.client.post('/api/logout', headers=first)
        self.assertEqual(self.client.get('/api/me', headers=second).status_code, 200)

    def test_forgot_limit_and_proxy_header_cannot_bypass(self):
        self.app.config['AUTH_RATE_LIMIT_ENABLED'] = True
        for index in range(5):
            response = self.client.post('/api/forgot-password', json={'email': f'unknown{index}@example.com'},
                                        headers={'X-Forwarded-For': f'10.0.0.{index}'})
            self.assertEqual(response.status_code, 202)
        response = self.client.post('/api/forgot-password', json={'email': 'another@example.com'},
                                    headers={'X-Forwarded-For': '10.9.9.9'})
        self.assertEqual(response.status_code, 429)

    def test_bootstrap_is_explicit_and_refuses_existing_database(self):
        from unittest.mock import patch
        runner = self.app.test_cli_runner()
        result = runner.invoke(args=['auth-local-bootstrap', '--email', 'new@example.com'],
                               input='local-password-123\nlocal-password-123\n')
        self.assertNotEqual(result.exit_code, 0)
        self.app.debug = True
        with patch.dict(os.environ, {'AUTH_ALLOW_LOCAL_BOOTSTRAP': '1'}):
            result = runner.invoke(args=['auth-local-bootstrap', '--email', 'new@example.com'],
                                   input='local-password-123\nlocal-password-123\n')
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn('Database must be empty', result.output)
        self.assertEqual(db.session.query(User).count(), 1)

    def test_missing_secret_is_rejected(self):
        app = Flask('missing-secret')
        app.config['JWT_SECRET_KEY'] = ''
        with self.assertRaises(RuntimeError):
            init_auth(app)

    def test_local_bootstrap_and_file_recovery(self):
        import tempfile
        from unittest.mock import patch
        db.session.remove()
        db.drop_all()
        self.app.debug = True
        self.app.config['AUTH_RESET_SENDER'] = None
        with patch.dict(os.environ, {'AUTH_ALLOW_LOCAL_BOOTSTRAP': '1'}):
            result = self.app.test_cli_runner().invoke(
                args=['auth-local-bootstrap', '--email', 'local@example.com'],
                input='local-password-123\nlocal-password-123\n')
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertNotIn('local-password-123', result.output)
        self.assertEqual(self.login(email='local@example.com', password='local-password-123').status_code, 200)
        with tempfile.TemporaryDirectory() as folder:
            self.app.config['AUTH_RESET_OUTBOX'] = folder
            response = self.client.post('/api/forgot-password', json={'email': 'local@example.com'})
            self.assertEqual(response.status_code, 202)
            files = list(Path(folder).glob('*.txt'))
            self.assertEqual(len(files), 1)
            self.assertEqual(files[0].stat().st_mode & 0o777, 0o600)
            token = parse_qs(urlparse(files[0].read_text().splitlines()[-1]).query)['token'][0]
            self.assertEqual(self.reset(token).status_code, 200)


if __name__ == '__main__':
    unittest.main()
