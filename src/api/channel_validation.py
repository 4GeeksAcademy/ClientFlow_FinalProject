"""Validate normalized channel messages before persistence."""


def required_text(value, field, maximum):
    if not isinstance(value, str):
        raise ValueError(f"{field} must be text.")

    value = value.strip()

    if not value or len(value) > maximum:
        raise ValueError(f"{field} must contain 1–{maximum} characters.")

    return value


def message_reference(value, field):
    value = required_text(value, field, 255)

    if any(character.isspace() or ord(character) < 32 for character in value):
        raise ValueError(f"{field} contains invalid characters.")

    return value


def message_content(value):
    content = required_text(value, "content", 10000)

    if "\x00" in content:
        raise ValueError("Message content contains a null character.")

    return content
