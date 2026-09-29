"""Recognize standalone greetings without making company claims."""

import json
from pathlib import Path
import re
import unicodedata


GREETINGS = json.loads(
    (Path(__file__).resolve().parents[1] / "data" / "ai_greetings.json").read_text(encoding="utf-8")
)

SPANISH_SMALL_TALK = re.compile(
    r"(?:hola+|hols|buenas|buenos dias|buenas tardes|buenas noches)"
    r"(?: (?:que tal|como estas|todo bien))?"
)


def opening_reply(question, history):
    """Respond only to a greeting; combined requests require contextual generation."""
    text = unicodedata.normalize("NFKD", question.casefold())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    exact_reply = GREETINGS.get(text)
    if exact_reply:
        return exact_reply

    if SPANISH_SMALL_TALK.fullmatch(text):
        return "¡Hola! Todo bien, gracias. ¿En qué podemos ayudarte?"

    return None
