import unittest
from flask import Blueprint
from sqlalchemy import select
import test_auth
from api.appointments import register_appointments
from api.models import Client, CompanyMembership, db


class AppointmentTest(unittest.TestCase):
    setUpBase = test_auth.AuthenticationTest.setUp
    tearDown = test_auth.AuthenticationTest.tearDown
    login = test_auth.AuthenticationTest.login
    headers = test_auth.AuthenticationTest.headers

    def setUp(self):
        self.setUpBase()
        api = Blueprint('schedule_test', __name__)
        register_appointments(api)
        self.app.register_blueprint(api, url_prefix='/api')
        own = Client(company_id=self.company_id, first_name='Own client')
        other = Client(company_id=self.other_id, first_name='Other client')
        db.session.add_all([own, other])
        db.session.commit()
        self.other_client = other.id
        self.auth = self.headers() | {'X-Company-ID': str(self.company_id)}
        self.data = dict(title='Visit', client_id=own.id,
                        assigned_membership_id=db.session.scalar(select(CompanyMembership.id)),
                        starts_at='2026-10-01T10:00:00+02:00', ends_at='2026-10-01T11:00:00+02:00')

    def create(self, **changes):
        return self.client.post('/api/appointments', json=self.data | changes, headers=self.auth)

    def test_create_move_cancel_and_conflict(self):
        first = self.create()
        self.assertEqual(first.status_code, 201, first.json)
        identifier = first.json['id']
        self.assertEqual(first.json['appointment']['starts_at'], '2026-10-01T08:00:00+00:00')
        self.assertEqual(self.create().status_code, 409)
        response = self.client.put(f'/api/appointments/{identifier}', headers=self.auth,
                                  json={'starts_at': '2026-10-01T12:00:00Z', 'ends_at': '2026-10-01T13:00:00Z'})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.create().status_code, 201)
        self.assertEqual(self.client.delete(f'/api/appointments/{identifier}', headers=self.auth).status_code, 200)

    def test_validation_and_tenant_options(self):
        for changes in [{'client_id': self.other_client}, {'ends_at': 'bad'}, {'ends_at': self.data['starts_at']}, {'status': 'unknown'}, {'assigned_membership_id': True}]:
            self.assertEqual(self.create(**changes).status_code, 400, changes)
        options = self.client.get('/api/appointments/options', headers=self.auth)
        self.assertEqual(options.status_code, 200, options.json)
        self.assertEqual([item['name'] for item in options.json['clients']], ['Own client'])
        self.assertEqual(self.client.get('/api/appointments', headers=self.auth | {'X-Company-ID': str(self.other_id)}).status_code, 403)

    def test_reactivation_cannot_overlap_and_ranges(self):
        cancelled = self.create(status='cancelled').json['id']
        self.assertEqual(self.create().status_code, 201)
        self.assertEqual(self.client.put(f'/api/appointments/{cancelled}', json={'status': 'scheduled'}, headers=self.auth).status_code, 409)
        self.assertEqual(self.client.get('/api/appointments?start_date=2026-10-01T09:00:00Z', headers=self.auth).json, [])
        self.assertEqual(self.client.get('/api/appointments?start_date=bad', headers=self.auth).status_code, 400)
