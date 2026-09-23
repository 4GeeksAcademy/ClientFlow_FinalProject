"""Verify that generation failures do not produce automatic replies."""

import unittest
from unittest.mock import patch

from api.ai_orchestration import generate_reply_draft


class AIOrchestrationTest(unittest.TestCase):
    def test_no_sources_does_not_call_agent(self):
        with (
            patch(
                "api.ai_orchestration.build_conversation_context",
                return_value={"needs_human": True},
            ),
            patch("api.ai_orchestration.request_agent_reply") as request,
        ):
            result = generate_reply_draft(1, 3, "What is the price?")

        request.assert_not_called()
        self.assertEqual(result["status"], "handoff")
        self.assertIsNone(result["reply"])

    def test_invented_source_requires_handoff(self):
        context = {
            "needs_human": False,
            "sources": [{"chunk_id": 10, "content": "Furniture repairs.", "score": 0.9}],
        }

        with (
            patch(
                "api.ai_orchestration.build_conversation_context",
                return_value=context,
            ),
            patch(
                "api.ai_orchestration.build_agent_message",
                return_value={"message": "Test", "source_ids": [10]},
            ),
            patch(
                "api.ai_orchestration.request_agent_reply",
                return_value=(
                    '{"reply":"Test","source_ids":[999],"needs_human":false}'
                ),
            ),
        ):
            result = generate_reply_draft(1, 3, "What is the price?")

        self.assertEqual(result["reason"], "invalid_agent_response")
        self.assertIsNone(result["reply"])

    def test_valid_answer_still_requires_approval(self):
        source = {'chunk_id': 10, 'content': 'Furniture repairs.', 'score': 0.9}
        with (
            patch('api.ai_orchestration.build_conversation_context', return_value={'needs_human': False, 'sources': [source]}),
            patch('api.ai_orchestration.build_agent_message', return_value={'message': 'Test', 'source_ids': [10]}),
            patch('api.ai_orchestration.request_agent_reply', return_value='{"reply":"We repair furniture.","source_ids":[10],"needs_human":false}'),
        ):
            result = generate_reply_draft(1, 3, 'Services?')
        self.assertEqual(result['status'], 'pending_review')
        self.assertTrue(result['requires_approval'])

    def test_low_similarity_does_not_call_agent(self):
        with (
            patch('api.ai_orchestration.build_conversation_context', return_value={'needs_human':False,'sources':[{'score':0.1}]}),
            patch('api.ai_orchestration.request_agent_reply') as request,
        ):
            result=generate_reply_draft(1,3,'Unknown?')
        request.assert_not_called()
        self.assertEqual(result['reason'],'insufficient_relevance')
