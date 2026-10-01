import unittest

from api.ai_fallback import conversational_fallback


class AIFallbackTest(unittest.TestCase):
    def test_common_service_openings_receive_one_safe_question(self):
        for question in (
            "Hola, quiero cambiar mi vestidor",
            "Boa tarde, preciso consertar uma porta",
            "Hi, I need to install a wardrobe",
        ):
            with self.subTest(question=question):
                result = conversational_fallback(question)
                self.assertEqual(result["status"], "pending_review")
                self.assertTrue(result["requires_approval"])
                self.assertEqual(result["sources"], [])
                self.assertEqual(result["reply"].count("?"), 1)

    def test_fallback_does_not_claim_prices_or_company_facts(self):
        result = conversational_fallback("¿Cuánto cuesta un armario?")
        self.assertNotIn("€", result["reply"])
        self.assertNotIn("euros", result["reply"].lower())


if __name__ == "__main__":
    unittest.main()
