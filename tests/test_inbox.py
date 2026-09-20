"""Inbox integration tests using a disposable database."""
import unittest
import test_auth as auth_fixture
from api.inbox import inbox, receive_message
from api.models import db, Conversation, ConversationParticipant, CompanyMembership, AIAgent, ChannelType


class InboxTest(unittest.TestCase):
    def setUp(self):
        self.fixture = auth_fixture.AuthenticationTest()
        self.fixture.setUp()
        self.fixture.app.register_blueprint(inbox, url_prefix='/api')
        self.client = self.fixture.client
        self.headers = self.fixture.headers() | {'X-Company-ID': str(self.fixture.company_id)}

    def tearDown(self):
        self.fixture.tearDown()

    def create(self, subject='Test conversation'):
        response = self.client.post('/api/conversations', headers=self.headers, json={'subject': subject})
        self.assertEqual(response.status_code, 201)
        return response.json['conversation']['id']

    def test_history_pagination_and_conversation_isolation(self):
        first, second = self.create('First'), self.create('Second')
        for content in ['One', 'Two', 'Three']:
            response = self.client.post(f'/api/conversations/{first}/messages', headers=self.headers, json={'content': content})
            self.assertEqual(response.status_code, 201)
        response = self.client.get(f'/api/conversations/{first}/messages?per_page=2&page=2', headers=self.headers)
        self.assertEqual(response.json['total'], 3)
        self.assertEqual([m['content'] for m in response.json['messages']], ['Three'])
        self.assertEqual(self.client.get(f'/api/conversations/{second}/messages', headers=self.headers).json['total'], 0)
        self.assertEqual(self.client.get('/api/conversations?per_page=1&page=2', headers=self.headers).json['conversations'][0]['id'], first)

    def test_foreign_company_and_anonymous_requests_are_rejected(self):
        foreign = Conversation(company_id=self.fixture.other_id, subject='Private', channel=ChannelType.WEB)
        db.session.add(foreign)
        db.session.commit()
        base = f'/api/conversations/{foreign.id}'
        self.assertEqual(self.client.get('/api/conversations').status_code, 401)
        self.assertEqual(self.client.get('/api/conversations', headers=self.headers).json['total'], 0)
        for method, suffix, data in [('get', '/messages', None), ('post', '/messages', {'content': 'No'}), ('patch', '/read', {'message_id': 1}), ('patch', '/control', {'mode': 'human'}), ('patch', '/assignment', {'membership_id': None})]:
            response = getattr(self.client, method)(base + suffix, headers=self.headers, json=data)
            self.assertEqual(response.status_code, 404)

    def test_inbound_read_marker_and_validation(self):
        cid = self.create()
        participant = ConversationParticipant(conversation_id=cid, participant_type='external', external_identifier='test-visitor')
        db.session.add(participant)
        db.session.flush()
        first = receive_message(self.fixture.company_id, cid, participant.id, 'Inbound one')
        second = receive_message(self.fixture.company_id, cid, participant.id, 'Inbound two')
        db.session.commit()
        for mid in [second.id, first.id]:
            response = self.client.patch(f'/api/conversations/{cid}/read', headers=self.headers, json={'message_id': mid})
            self.assertEqual(response.json['last_read_message_id'], second.id)
        with self.assertRaises(ValueError):
            receive_message(self.fixture.other_id, cid, participant.id, 'Invalid')
        with self.assertRaises(ValueError):
            receive_message(self.fixture.company_id, cid, participant.id, ' ')
        self.assertEqual(self.client.post(f'/api/conversations/{cid}/messages', headers=self.headers, json={'content': ' '}).status_code, 400)
        self.assertEqual(self.client.get(f'/api/conversations/{cid}/messages?per_page=101', headers=self.headers).status_code, 400)

    def test_assignment_and_human_takeover(self):
        cid = self.create()
        base = f'/api/conversations/{cid}'
        mid = db.session.scalar(db.select(CompanyMembership.id).where(CompanyMembership.company_id == self.fixture.company_id))
        response = self.client.patch(base + '/assignment', headers=self.headers, json={'membership_id': mid})
        self.assertEqual(response.json['conversation']['assigned_membership_id'], mid)
        agents = [AIAgent(company_id=company, name='Test', purpose='Test', model_name='test', main_instruction='Test') for company in [self.fixture.company_id, self.fixture.other_id]]
        db.session.add_all(agents)
        db.session.commit()
        self.assertEqual(self.client.patch(base + '/control', headers=self.headers, json={'mode': 'ai', 'ai_agent_id': agents[1].id}).status_code, 404)
        self.assertEqual(self.client.patch(base + '/control', headers=self.headers, json={'mode': 'ai', 'ai_agent_id': agents[0].id}).status_code, 200)
        self.assertEqual(self.client.post(base + '/messages', headers=self.headers, json={'content': 'Blocked'}).status_code, 409)
        self.assertEqual(self.client.patch(base + '/control', headers=self.headers, json={'mode': 'human'}).status_code, 200)
        self.assertEqual(self.client.post(base + '/messages', headers=self.headers, json={'content': 'Allowed'}).status_code, 201)
