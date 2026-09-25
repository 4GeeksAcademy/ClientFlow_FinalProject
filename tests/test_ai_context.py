"""Test context assembly without calling the external AI service."""

import unittest
from unittest.mock import patch

from api.ai_context import build_conversation_context


class AIContextTest(unittest.TestCase):
    def test_followup_keeps_previous_subject(self):
        history = [
            {
                "message_id": 1,
                "direction": "inbound",
                "content": "Do you install kitchen cabinets?",
            }
        ]

        with (
            patch(
                "api.ai_context.load_conversation_agent",
                return_value={"id": 7},
            ),
            patch(
                "api.ai_context.load_conversation_history",
                return_value=history,
            ),
            patch(
                "api.ai_context.retrieve_knowledge",
                return_value=[{"chunk_id": 10}],
            ) as retrieve,
        ):
            context = build_conversation_context(1, 3, "How much does it cost?")

        company_id, agent_id, query = retrieve.call_args.args
        self.assertEqual((company_id, agent_id), (1, 7))
        self.assertIn("kitchen cabinets", query)
        self.assertIn("How much does it cost?", query)
        self.assertEqual(context["history"], history)
        self.assertEqual(context["sources"], [{"chunk_id": 10}])

    def test_missing_knowledge_requires_human(self):
        with (
            patch(
                "api.ai_context.load_conversation_agent",
                return_value={"id": 7},
            ),
            patch(
                "api.ai_context.load_conversation_history",
                return_value=[],
            ),
            patch(
                "api.ai_context.retrieve_knowledge",
                return_value=[],
            ),
        ):
            context = build_conversation_context(1, 3, "What is the price?")

        self.assertTrue(context["needs_human"])
        self.assertEqual(context["sources"], [])

    def test_old_greetings_do_not_dilute_current_question(self):
        with (
            patch("api.ai_context.load_conversation_agent", return_value={"id": 7}),
            patch("api.ai_context.load_conversation_history", return_value=[
                {"direction": "inbound", "content": "Hi there"}
            ]),
            patch("api.ai_context.retrieve_knowledge", side_effect=[
                [{"chunk_id": 10, "score": 0.58}],
                [{"chunk_id": 10, "score": 0.39}],
            ]) as retrieve,
        ):
            context = build_conversation_context(10, 3, "Do you make kitchen cabinets?")
        self.assertEqual(retrieve.call_args_list[0].args, (10, 7, "Do you make kitchen cabinets?"))
        self.assertEqual(context["sources"], [{"chunk_id": 10, "score": 0.58}])
