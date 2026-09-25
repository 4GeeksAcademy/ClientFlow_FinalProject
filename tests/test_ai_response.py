"""Clarifications never silently relax validation of factual answers."""
import json
import unittest
from api.ai_response import validate_agent_reply

class AIResponseTest(unittest.TestCase):
    def reply(self, **changes):
        data = dict(reply='What would you like to install?', source_ids=[],
                    needs_human=False, response_type='clarification')
        return json.dumps(data | changes)

    def test_clarification_requires_explicit_mode(self):
        with self.assertRaises(ValueError):
            validate_agent_reply(self.reply(), [])
        self.assertEqual(validate_agent_reply(self.reply(), [], allow_clarification=True)['source_ids'], [])

    def test_uncited_answer_remains_invalid_in_conversation_mode(self):
        with self.assertRaises(ValueError):
            validate_agent_reply(self.reply(reply='Installation costs 50 euros.', response_type='answer'), [], allow_clarification=True)

    def test_bad_or_inconsistent_types_are_rejected(self):
        for changes in ({'response_type':'unknown'}, {'response_type':'handoff'},
                        {'needs_human':True}, {'reply':'Question one? Question two?'},
                        {'source_ids':[True]}, {'source_ids':[999]}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_agent_reply(self.reply(**changes), [1], allow_clarification=True)

    def test_handoff_can_explain_missing_information_without_sources(self):
        result = validate_agent_reply(self.reply(reply='The team must confirm the price.',
            response_type='handoff', needs_human=True), [], allow_clarification=True)
        self.assertTrue(result['needs_human'])

    def test_polite_request_does_not_require_question_mark(self):
        result = validate_agent_reply(self.reply(reply="Please tell me which finish you prefer."), [], allow_clarification=True)
        self.assertFalse(result["needs_human"])
