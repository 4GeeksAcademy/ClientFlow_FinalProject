"""AI acceptance tests against an isolated database, never real customer data."""
import json
import unittest
from unittest.mock import patch
import test_auth
from api.ai_routes import ai
from api.ai_retrieval import authorized_chunks
from api.models import (db, AIAgent, AIReplyDraft, AIReplyAudit, Conversation, ChannelType,
                        KnowledgeDocument, KnowledgeChunk, CompanyMembership, MembershipRole, Message)


class AIRoutesTest(unittest.TestCase):
    def setUp(self):
        self.fixture=test_auth.AuthenticationTest()
        self.fixture.setUp()
        self.app=self.fixture.app
        self.app.register_blueprint(ai,url_prefix='/api')
        self.client=self.fixture.client
        self.company=self.fixture.company_id
        self.headers=self.fixture.headers() | {'X-Company-ID':str(self.company)}
        member=db.session.scalar(db.select(CompanyMembership))
        self.member=member
        self.agent=AIAgent(company_id=self.company,name='Assistant',purpose='Support',model_name='qwen2.5:3b',main_instruction='Use sources.')
        self.doc=KnowledgeDocument(company_id=self.company,title='Services',source_type='text',ingestion_status='ready',uploaded_by_membership_id=member.id)
        self.agent.knowledge_documents=[self.doc]
        db.session.add_all([self.agent,self.doc])
        db.session.flush()
        self.chunk=KnowledgeChunk(document_id=self.doc.id,chunk_index=0,content='We repair furniture.',embedding=[1.,0.],embedding_model='test',embedding_dimensions=2)
        self.conv=Conversation(company_id=self.company,channel=ChannelType.WEB,ai_agent_id=self.agent.id)
        db.session.add_all([self.chunk,self.conv]);db.session.commit()

    def tearDown(self):
        self.fixture.tearDown()

    def generate(self):
        source={'chunk_id':self.chunk.id,'document_id':self.doc.id,'chunk_index':0,'content':self.chunk.content,'score':0.9}
        with patch('api.ai_routes.generate_reply_draft',return_value={'status':'pending_review','reply':'We repair furniture.','sources':[source],'reason':None}):
            response=self.client.post(f'/api/conversations/{self.conv.id}/ai-drafts',headers=self.headers,json={'question':'Services?'})
        self.assertEqual(response.status_code,201,response.json)
        return response.json['draft']['id']

    def decide(self,identifier,action='approve'):
        return self.client.post(f'/api/ai/drafts/{identifier}/decision',headers=self.headers,json={'action':action})

    def test_approval_and_duplicate_and_audit(self):
        identifier=self.generate()
        self.assertEqual(db.session.query(Message).count(),0)
        self.assertEqual(self.decide(identifier).status_code,200)
        self.assertEqual(self.decide(identifier).status_code,409)
        self.assertEqual(db.session.query(Message).count(),1)
        self.assertEqual([e.action for e in db.session.scalars(db.select(AIReplyAudit).order_by(AIReplyAudit.id))],['generated','approved'])

    def test_cross_company_and_roles(self):
        identifier=self.generate()
        self.conv.company_id=self.fixture.other_id
        db.session.get(AIReplyDraft,identifier).company_id=self.fixture.other_id
        db.session.commit()
        self.assertEqual(self.client.get(f'/api/conversations/{self.conv.id}/ai-drafts',headers=self.headers).status_code,404)
        self.assertEqual(self.decide(identifier).status_code,404)
        self.member.role=MembershipRole.TECHNICIAN;db.session.commit()
        self.assertEqual(self.client.get('/api/ai/agents',headers=self.headers).status_code,403)

    def test_revoked_sources_prevent_approval(self):
        identifier=self.generate()
        self.agent.knowledge_documents=[];db.session.commit()
        self.assertEqual(self.decide(identifier).status_code,409)
        self.assertEqual(db.session.query(Message).count(),0)

    def test_reject_returns_human_control(self):
        identifier=self.generate()
        self.assertEqual(self.decide(identifier,'reject').status_code,200)
        self.assertIsNone(db.session.get(Conversation,self.conv.id).ai_agent_id)
        self.assertEqual(db.session.query(Message).count(),0)

    def test_retrieval_requires_company_and_explicit_assignment(self):
        self.assertEqual(len(authorized_chunks(self.company,self.agent.id)),1)
        self.assertEqual(authorized_chunks(self.fixture.other_id,self.agent.id),[])
        self.doc.company_id=self.fixture.other_id;db.session.commit()
        self.assertEqual(authorized_chunks(self.company,self.agent.id),[])

    def test_stale_conversation_prevents_approval(self):
        identifier=self.generate()
        from api.models import MessageDirection
        db.session.add(Message(conversation_id=self.conv.id,direction=MessageDirection.INBOUND,content='Changed request',delivery_status='received'))
        db.session.commit()
        self.assertEqual(self.decide(identifier).status_code,409)

    def test_handoff_is_recorded_without_message(self):
        from api.ai_orchestration import handoff_result
        with patch('api.ai_routes.generate_reply_draft',return_value=handoff_result('insufficient_relevance')):
            r=self.client.post(f'/api/conversations/{self.conv.id}/ai-drafts',headers=self.headers,json={'question':'Unknown?'})
        self.assertEqual(r.status_code,201,r.json)
        self.assertIsNone(self.conv.ai_agent_id)
        self.assertEqual(db.session.query(Message).count(),0)
        self.assertEqual(db.session.scalar(db.select(AIReplyAudit)).action,'handoff')

    def test_configuration_rejects_foreign_document(self):
        self.doc.company_id=self.fixture.other_id;db.session.commit()
        r=self.client.post('/api/ai/agents',headers=self.headers,json={'name':'Test','purpose':'Support','main_instruction':'Use sources','document_ids':[self.doc.id]})
        self.assertEqual(r.status_code,400)

    def test_context_and_retrieval_through_generation_endpoint(self):
        import os
        answer=json.dumps({'reply':'We repair furniture.','source_ids':[self.chunk.id],'needs_human':False})
        with (
            patch.dict(os.environ, {'KNOWLEDGE_EMBEDDINGS_MODEL':'test'}),
            patch('api.ai_retrieval.request_embeddings',return_value=[[1.,0.]]),
            patch('api.ai_orchestration.request_agent_reply',return_value=answer),
        ):
            r=self.client.post(f'/api/conversations/{self.conv.id}/ai-drafts',headers=self.headers,json={'question':'Services?'})
        self.assertEqual(r.status_code,201,r.json)
        self.assertEqual(r.json['draft']['status'],'pending_review')
        self.assertEqual(r.json['draft']['sources'][0]['document_id'],self.doc.id)

    def test_context_cannot_load_another_company_conversation(self):
        from api.ai_context import load_conversation_history, load_conversation_agent
        with self.assertRaises(ValueError): load_conversation_history(self.fixture.other_id,self.conv.id)
        with self.assertRaises(ValueError): load_conversation_agent(self.fixture.other_id,self.conv.id)

    def test_schema_command_is_idempotent(self):
        from api.commands import setup_commands
        setup_commands(self.app)
        runner=self.app.test_cli_runner()
        self.assertEqual(runner.invoke(args=['ai-schema-upgrade']).exit_code,0)
        self.assertEqual(runner.invoke(args=['ai-schema-upgrade']).exit_code,0)
        self.assertIsNotNone(db.session.get(AIAgent,self.agent.id))
