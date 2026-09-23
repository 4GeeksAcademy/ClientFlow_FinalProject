"""Provider contract, source validation and prompt size regression tests."""
import io
import json
import os
import unittest
from unittest.mock import patch, MagicMock
from urllib.error import URLError
from api.ai_service import request_agent_reply, AgentServiceError
from api.ai_prompt import build_agent_message
from api.ai_response import validate_agent_reply

class AIServiceTest(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ, {'AI_SERVICE_URL':'https://example.invalid/respond',
            'AI_SERVICE_COMPANY_KEYS':'{"1":"synthetic-key"}', 'AI_SERVICE_COMPANY_ID':'',
            'AI_SERVICE_MODEL':'qwen2.5:3b'})
        self.env.start()
    def tearDown(self):
        self.env.stop()
    def test_payload_has_no_remote_memory_and_checks_model(self):
        opener=MagicMock()
        opener.open.return_value=io.BytesIO(json.dumps({'reply':'{}','conversation_id':None,'model':'qwen2.5:3b'}).encode())
        with patch('api.ai_service.build_opener',return_value=opener):
            self.assertEqual(request_agent_reply('Synthetic',company_id=1),'{}')
        request=opener.open.call_args.args[0]
        self.assertIsNone(json.loads(request.data)['conversation_id'])
        self.assertEqual(opener.open.call_args.kwargs['timeout'],60)
    def test_other_company_does_not_reuse_credentials(self):
        with patch('api.ai_service.build_opener') as opener:
            with self.assertRaises(AgentServiceError): request_agent_reply('Test',company_id=2)
        opener.assert_not_called()
    def test_connection_error_hides_provider_details(self):
        with patch('api.ai_service.build_opener') as opener:
            opener.return_value.open.side_effect=URLError('secret-value')
            with self.assertRaises(AgentServiceError) as result: request_agent_reply('Test',company_id=1)
        self.assertNotIn('secret-value',str(result.exception))
    def test_remote_memory_is_rejected(self):
        with patch('api.ai_service.build_opener') as opener:
            opener.return_value.open.return_value=io.BytesIO(b'{"reply":"test","conversation_id":"shared","model":"qwen2.5:3b"}')
            with self.assertRaises(AgentServiceError): request_agent_reply('Test',company_id=1)
    def test_prompt_tracks_only_retained_sources(self):
        context={'agent':{'main_instruction':'Use sources'},'history':[], 'question':'Services?',
                 'sources':[{'chunk_id':1,'content':'Repairs'},{'chunk_id':2,'content':'x'*5000}]}
        prepared=build_agent_message(context)
        self.assertLessEqual(len(prepared['message']),4000)
        self.assertEqual(prepared['source_ids'],[1])
        with self.assertRaises(ValueError):
            validate_agent_reply('{"reply":"Test","source_ids":[2],"needs_human":false}',prepared['source_ids'])
    def test_invalid_boolean_and_source_types_rejected(self):
        for value in ['{"reply":"X","source_ids":[true],"needs_human":false}',
                      '{"reply":"X","source_ids":[1],"needs_human":"false"}',
                      '{"reply":"X","source_ids":[],"needs_human":false}']:
            with self.assertRaises(ValueError): validate_agent_reply(value,[1])
