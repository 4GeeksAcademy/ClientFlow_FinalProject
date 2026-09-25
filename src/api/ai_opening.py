"""Recognize standalone greetings without making company claims."""

import json
from pathlib import Path
import re
import unicodedata


GREETINGS = json.loads(
    (Path(__file__).resolve().parents[1] / "data" / "ai_greetings.json").read_text(encoding="utf-8")
)


def opening_reply(question, history):
    """Respond only to a greeting; combined requests require contextual generation."""
    text = unicodedata.normalize("NFKD", question.casefold())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"\s+", " ", text).strip(" ¡!¿?.,")
    return GREETINGS.get(text)
