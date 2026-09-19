"""Onboarding contract and subscription access regression tests."""
import sys
import unittest
from pathlib import Path
from datetime import timedelta
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from flask import Flask
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from api.models import db, Plan, User, Company, Subscription, CompanyMembership, MembershipRole, SubscriptionStatus, utc_now
from api.auth import init_auth, subscription_allows_access
from api.routes import api

class OnboardingTest(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI='sqlite://',
                          JWT_SECRET_KEY='test-secret-' * 8, AUTH_RATE_LIMIT_ENABLED=False)
        db.init_app(app)
        init_auth(app)
        app.register_blueprint(api, url_prefix='/api')
        self.ctx = app.app_context()
        self.ctx.push()
        db.create_all()
        self.plan = Plan(code='starter', name='Starter', price_eur=29.99)
        db.session.add(self.plan)
        db.session.commit()
        self.client = app.test_client()
        self.data = dict(firstName='Test', lastName='Owner', email='test@example.com',
                         company='Company', password='test-password-123', plan_id=self.plan.id)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.ctx.pop()

    def register(self, **changes):
        return self.client.post('/api/register', json={**self.data, **changes})

    def test_trial_and_expiry_with_existing_session(self):
        self.assertEqual(self.register().status_code, 201)
        member = db.session.scalar(select(CompanyMembership))
        self.assertEqual(member.role, MembershipRole.OWNER)
        sub = db.session.scalar(select(Subscription))
        self.assertEqual(sub.trial_ends_at - sub.trial_started_at, timedelta(days=3))
        token = self.client.post('/api/login', json=self.data).json['token']
        headers = {'Authorization': 'Bearer ' + token, 'X-Company-ID': str(member.company_id)}
        self.assertEqual(self.client.get('/api/auth/context', headers=headers).status_code, 200)
        sub.trial_ends_at = utc_now() - timedelta(seconds=1)
        db.session.commit()
        response = self.client.get('/api/auth/context', headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json['code'], 'subscription_required')

    def test_mock_payment_and_expiry(self):
        self.assertEqual(self.register(registration_mode='mock_payment').status_code, 201)
        sub = db.session.scalar(select(Subscription))
        self.assertEqual(sub.status, SubscriptionStatus.ACTIVE)
        self.assertTrue(sub.external_subscription_id.startswith('mock_'))
        self.assertEqual(sub.current_period_ends_at-sub.current_period_started_at, timedelta(days=30))
        self.assertIsNone(sub.trial_ends_at)
        self.assertTrue(subscription_allows_access(sub))
        sub.current_period_ends_at = utc_now() - timedelta(seconds=1)
        self.assertFalse(subscription_allows_access(sub))

    def test_validation_does_not_create_records(self):
        for changes in [dict(password='short'), dict(plan_id=True), dict(plan_id=999),
                        dict(registration_mode='invalid'), dict(firstName=[]), dict(company='')]:
            with self.subTest(changes=changes):
                self.assertEqual(self.register(**changes).status_code, 400)
        self.assertEqual(db.session.scalar(select(func.count()).select_from(User)), 0)

    def test_duplicate_email(self):
        self.assertEqual(self.register().status_code, 201)
        self.assertEqual(self.register().status_code, 409)
        self.assertEqual(db.session.scalar(select(func.count()).select_from(Company)), 1)

    def test_inactive_plan_hidden_and_rejected(self):
        self.plan.is_active = False
        db.session.commit()
        self.assertEqual(self.client.get('/api/plans').json, [])
        self.assertEqual(self.register().status_code, 400)

    def test_registration_rolls_back_on_conflict(self):
        with patch.object(db.session, 'commit', side_effect=IntegrityError('insert', {}, Exception())):
            self.assertEqual(self.register().status_code, 409)
        for model in (User, Company, CompanyMembership, Subscription):
            self.assertEqual(db.session.scalar(select(func.count()).select_from(model)), 0)

    def test_missing_cancelled_and_boundary(self):
        self.assertFalse(subscription_allows_access(None))
        self.register()
        sub = db.session.scalar(select(Subscription))
        now = utc_now()
        sub.trial_ends_at = now
        with patch('api.auth.utc_now', return_value=now):
            self.assertFalse(subscription_allows_access(sub))
        sub.status = SubscriptionStatus.CANCELLED
        sub.trial_ends_at = now + timedelta(days=3)
        self.assertFalse(subscription_allows_access(sub))
