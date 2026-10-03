"""Verify bounded prompts retain complete evidence."""
import unittest
from api.ai_prompt import build_agent_message

class AIPromptTest(unittest.TestCase):
    def test_long_history_can_be_removed_to_fit_source(self):
        result = build_agent_message({
            'agent': {'main_instruction': 'Use authorized facts.'},
            'question': 'Do you make cabinets?',
            'history': [{'direction':'outbound','content':'x' * 8000}] * 2,
            'sources': [{'chunk_id':1,'content':'We make cabinets. ' * 30}],
        })
        self.assertLessEqual(len(result['message']),12000)
        self.assertEqual(result['source_ids'],[1])
        self.assertIn('We make cabinets.',result['message'])

    def test_current_question_is_not_repeated_in_history(self):
        import json
        context = {'agent': {'main_instruction': 'Help.'}, 'question': 'A white wardrobe',
                   'sources': [], 'history': [{'direction':'inbound','content':'A white wardrobe'}]}
        result = build_agent_message(context)
        payload = json.loads(result['message'][result['message'].rindex('\n{')+1:])
        self.assertEqual(payload['history'], [])
        self.assertEqual(len(context['history']), 1)
