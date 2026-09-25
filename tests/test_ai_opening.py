"""Standalone greetings are distinct from contextual customer requests."""
import unittest
from unittest.mock import patch
from api.ai_opening import opening_reply
from api.ai_context import build_conversation_context
from api.ai_orchestration import generate_reply_draft

class AIOpeningTest(unittest.TestCase):
    def test_greetings_in_supported_languages(self):
        for question in ('Hola!', '  buenos días  ', 'Buenas tardes', 'buenas noches',
                         'Good morning', 'Hello', 'Olá', 'Boa noite'):
            with self.subTest(question=question):
                self.assertEqual(opening_reply(question, []).count('?'), 1)

    def test_requests_are_not_replaced_with_a_fixed_template(self):
        for question in ('Hola, quiero cambiar mi vestidor', 'Quiero instalar un armario',
                         'Quiero comprar una mesa', 'Buenas tardes, necesito arreglar una puerta',
                         '¿Cuánto cuesta?', 'Hola, ¿trabajáis en Madrid?'):
            self.assertIsNone(opening_reply(question, []))

    def test_greeting_keeps_company_authorization_and_skips_retrieval(self):
        with patch('api.ai_context.load_conversation_agent', return_value={'id':7}) as agent, \
             patch('api.ai_context.load_conversation_history', return_value=[]), \
             patch('api.ai_context.retrieve_knowledge') as retrieve:
            context = build_conversation_context(10, 3, 'Buenas tardes')
        agent.assert_called_once_with(10, 3)
        retrieve.assert_not_called()
        with patch('api.ai_orchestration.build_conversation_context', return_value=context), \
             patch('api.ai_orchestration.request_agent_reply') as service:
            result = generate_reply_draft(10, 3, 'Buenas tardes')
        service.assert_not_called()
        self.assertEqual(result['status'], 'pending_review')
        self.assertTrue(result['requires_approval'])
        self.assertEqual(result['sources'], [])

    def test_greeting_cannot_bypass_agent_authorization(self):
        with patch('api.ai_context.load_conversation_agent', side_effect=ValueError('Not authorized')):
            with self.assertRaises(ValueError):
                build_conversation_context(999, 3, 'Hola')
