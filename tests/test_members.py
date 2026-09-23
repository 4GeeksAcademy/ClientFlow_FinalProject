"""Team invitations, tenant boundaries and membership authorization."""
import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

import test_auth
from api.auth import digest, set_password
from api.members import members
from api.models import db, User, CompanyMembership, MembershipRole, MemberInvitation, utc_now


class MembersTest(unittest.TestCase):
    def setUp(self):
        self.fixture = test_auth.AuthenticationTest()
        self.fixture.setUp()
        self.app = self.fixture.app
        self.app.register_blueprint(members, url_prefix='/api')
        self.folder = tempfile.TemporaryDirectory()
        self.app.config.update(DEBUG=True, MEMBER_INVITE_OUTBOX=self.folder.name)
        self.client = self.fixture.client
        self.company = self.fixture.company_id
        self.owner = self.fixture.headers() | {'X-Company-ID': str(self.company)}
        self.owner_member = db.session.scalar(db.select(CompanyMembership))

    def tearDown(self):
        self.fixture.tearDown()
        self.folder.cleanup()

    def user(self, email, role=MembershipRole.AGENT, company=None):
        user = User(email=email, first_name='Team', last_name='Member', is_active=True)
        set_password(user, 'test-password-123')
        db.session.add(user)
        db.session.flush()
        member = CompanyMembership(user_id=user.id, company_id=company or self.company, role=role)
        db.session.add(member)
        db.session.commit()
        return user, member

    def headers(self, email):
        login = self.client.post('/api/login', json={'email': email, 'password': 'test-password-123'})
        return {'Authorization': 'Bearer ' + login.json['token'], 'X-Company-ID': str(self.company)}

    def invite(self, email='invited@example.com', role='agent', headers=None):
        response = self.client.post('/api/members/invitations', headers=headers or self.owner, json={'email': email, 'role': role})
        self.assertEqual(response.status_code, 201, response.json)
        invitation = db.session.get(MemberInvitation, response.json['invitation_id'])
        path = Path(self.folder.name) / (invitation.token_hash + '.json')
        payload = json.loads(path.read_text())
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertNotIn('token', response.json)
        self.assertIn('/accept-invitation#token=', payload['url'])
        self.assertEqual(digest(payload['token']), invitation.token_hash)
        return payload['token'], invitation

    def register(self, token, **extra):
        return self.client.post('/api/members/invitations/register', json={
            'token': token, 'first_name': 'Invited', 'last_name': 'User',
            'password': 'test-password-123', 'password_confirmation': 'test-password-123', **extra})

    def test_registration_company_and_replay(self):
        token, invitation = self.invite()
        result = self.register(token, company_id=self.fixture.other_id, role='owner')
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(result.json['company_id'], self.company)
        user = db.session.scalar(db.select(User).where(User.email == invitation.email))
        membership = db.session.scalar(db.select(CompanyMembership).where(CompanyMembership.user_id == user.id))
        self.assertEqual(membership.role, MembershipRole.AGENT)
        self.assertEqual(self.register(token).status_code, 400)

    def test_expired_and_wrong_email(self):
        user, _ = self.user('different@example.com', company=self.fixture.other_id)
        token, invitation = self.invite()
        response = self.client.post('/api/members/invitations/accept', headers=self.headers(user.email), json={'token': token})
        self.assertEqual(response.status_code, 400)
        invitation.expires_at = utc_now() - timedelta(seconds=1)
        db.session.commit()
        self.assertEqual(self.register(token).status_code, 400)
        self.assertIsNone(db.session.scalar(db.select(User).where(User.email == invitation.email)))

    def test_existing_account_accepts_once(self):
        user, _ = self.user('existing@example.com', company=self.fixture.other_id)
        token, _ = self.invite(user.email)
        headers = self.headers(user.email)
        self.assertEqual(self.register(token).status_code, 409)
        response = self.client.post('/api/members/invitations/accept', headers=headers, json={'token': token})
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json['company_id'], self.company)
        self.assertEqual(self.client.post('/api/members/invitations/accept', headers=headers, json={'token': token}).status_code, 400)

    def test_roles_and_tenant_boundaries(self):
        user, agent = self.user('agent@example.com')
        admin_user, admin = self.user('admin@example.com', MembershipRole.ADMIN)
        _, foreign = self.user('foreign@example.com', company=self.fixture.other_id)
        agent_headers, admin_headers = self.headers(user.email), self.headers(admin_user.email)
        self.assertEqual(self.client.get('/api/members', headers=agent_headers).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/members/{foreign.id}', headers=self.owner, json={'is_active': False}).status_code, 404)
        for member_id in [admin.id, self.owner_member.id]:
            self.assertEqual(self.client.patch(f'/api/members/{member_id}', headers=admin_headers, json={'is_active': False}).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/members/{agent.id}', headers=admin_headers, json={'role': 'admin'}).status_code, 403)
        self.assertEqual(self.client.post('/api/members/invitations', headers=admin_headers, json={'email':'new@example.com', 'role':'owner'}).status_code, 400)

    def test_deactivation_revokes_tenant_access(self):
        user, member = self.user('active@example.com')
        headers = self.headers(user.email)
        self.assertEqual(self.client.patch(f'/api/members/{member.id}', headers=self.owner, json={'role':'manager','is_active':False}).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 403)
        self.assertEqual(self.client.get('/api/me', headers=headers).json['companies'], [])
        self.assertEqual(self.client.patch(f'/api/members/{member.id}', headers=self.owner, json={'is_active':True}).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 200)

    def test_inviter_permissions_rechecked(self):
        user, admin = self.user('inviter@example.com', MembershipRole.ADMIN)
        token, _ = self.invite(headers=self.headers(user.email))
        admin.is_active = False
        db.session.commit()
        self.assertEqual(self.register(token).status_code, 400)
        self.assertIsNone(db.session.scalar(db.select(User).where(User.email == 'invited@example.com')))

    def test_search_filter_and_pagination(self):
        _, member = self.user('searchable@example.com')
        self.user('hidden@example.com', company=self.fixture.other_id)
        member.is_active = False
        db.session.commit()
        data = self.client.get('/api/members?search=searchable&status=inactive&per_page=1', headers=self.owner).json
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['members'][0]['id'], member.id)
        self.assertEqual(self.client.get('/api/members?search=hidden', headers=self.owner).json['total'], 0)
        self.assertEqual(self.client.get('/api/members?status=bad', headers=self.owner).status_code, 400)
        self.assertEqual(self.client.get('/api/members?page=0', headers=self.owner).status_code, 400)

    def test_invalid_payload_and_production_simulation(self):
        _, member = self.user('validation@example.com')
        for payload in ({'is_active':'false'}, {'role': []}, {}, {'company_id':3}, {'role':'owner'}):
            self.assertIn(self.client.patch(f'/api/members/{member.id}', headers=self.owner, json=payload).status_code, (400,403))
        self.app.config['DEBUG'] = False
        self.assertEqual(self.client.post('/api/members/invitations', headers=self.owner, json={'email':'new@example.com'}).status_code,503)
