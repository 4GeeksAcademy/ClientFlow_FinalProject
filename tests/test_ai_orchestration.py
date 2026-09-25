"""Verify that generation failures do not produce automatic replies."""

import unittest
from unittest.mock import patch

from api.ai_orchestration import generate_reply_draft


class AIOrchestrationTest(unittest.TestCase):
    def test_no_sources_allows_clarification_but_not_factual_answer(self):
        context = {"needs_human": True, "sources": [], "history": [],
                   "agent": {"main_instruction": "Help with customer requests."},
                   "question": "I want to install something."}
        for raw, expected in (
            ('{"reply":"What would you like to install?","source_ids":[],"needs_human":false,"response_type":"clarification"}', 'pending_review'),
            ('{"reply":"Installation costs 50 euros.","source_ids":[],"needs_human":false,"response_type":"answer"}', 'handoff'),
        ):
            with patch('api.ai_orchestration.build_conversation_context', return_value=context), \
                 patch('api.ai_orchestration.request_agent_reply', return_value=raw):
                result = generate_reply_draft(1, 3, context['question'])
            self.assertEqual(result['status'], expected)
            self.assertTrue(result['requires_approval'])

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

    def test_low_similarity_is_not_used_as_evidence(self):
        context = {"needs_human": False, "sources": [{"chunk_id":10,"score":0.1,"content":"Unrelated."}],
                   "history": [], "agent":{"main_instruction":"Help."}, "question":"Unknown?"}
        with patch('api.ai_orchestration.build_conversation_context', return_value=context), \
             patch('api.ai_orchestration.request_agent_reply', return_value='{"reply":"The team must confirm that.","source_ids":[],"needs_human":true,"response_type":"handoff"}') as request:
            result = generate_reply_draft(1,3,'Unknown?')
        self.assertNotIn('Unrelated.', request.call_args.args[0])
        self.assertEqual(result['reason'], 'agent_requested_human')
