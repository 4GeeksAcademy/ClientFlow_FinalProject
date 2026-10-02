"""Safe conversational clarifications when the private AI service is unavailable."""

import re
import unicodedata


def _normalized(value):
    text = unicodedata.normalize("NFKD", (value or "").casefold())
    return "".join(char for char in text if not unicodedata.combining(char))


def conversational_fallback(question):
    """Ask one useful question without making unsupported company claims."""
    text = _normalized(question)
    portuguese = bool(re.search(r"\b(ola|bom dia|boa tarde|boa noite|quero|preciso|consertar)\b", text))
    english = bool(re.search(r"\b(hello|hi|good morning|good afternoon|want|need|repair|install)\b", text))
    service_intent = bool(re.search(
        r"\b(cambiar|instalar|comprar|arreglar|reparar|hacer|quiero|necesito|"
        r"mudar|instalar|comprar|consertar|reparar|quero|preciso|"
        r"change|install|buy|repair|fix|want|need)\b",
        text,
    ))

    if portuguese:
        reply = ("Claro. Para começar, pode me dizer o que deseja fazer e em que localidade será o serviço?"
                 if service_intent else
                 "Olá! Como posso ajudar com o seu projeto hoje?")
    elif english:
        reply = ("Of course. To get started, what would you like done and where will the work take place?"
                 if service_intent else
                 "Hello! How can I help with your project today?")
    else:
        reply = ("Claro. Para empezar, ¿qué quieres hacer y en qué localidad se realizaría el trabajo?"
                 if service_intent else
                 "¡Hola! ¿En qué podemos ayudarte con tu proyecto?")

    return {
        "status": "pending_review",
        "reply": reply,
        "sources": [],
        "requires_approval": True,
        "reason": "local_clarification_fallback",
    }
