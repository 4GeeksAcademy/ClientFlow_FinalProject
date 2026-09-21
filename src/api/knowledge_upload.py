"""Validation for knowledge document uploads."""

from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile, ZipFile

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_DOCX_EXPANDED_BYTES = 30 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def read_upload(upload):
    if upload is None or not upload.filename:
        raise ValueError("A document is required.")

    extension = Path(upload.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Supported file types are PDF, DOCX and TXT.")

    content = upload.stream.read(MAX_UPLOAD_BYTES + 1)

    if not content:
        raise ValueError("The document is empty.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("The document exceeds the 10 MB limit.")

    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise ValueError("The file is not a valid PDF.")

    if extension == ".docx":
        validate_docx(content)

    if extension == ".txt":
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError("Text files must use UTF-8 encoding.") from error

        if "\x00" in text:
            raise ValueError("The file contains binary data.")

    return content, extension


def validate_docx(content):
    try:
        with ZipFile(BytesIO(content)) as archive:
            entries = archive.infolist()
            names = {entry.filename for entry in entries}

            if len(entries) > 2000:
                raise ValueError("The DOCX contains too many entries.")

            if sum(entry.file_size for entry in entries) > MAX_DOCX_EXPANDED_BYTES:
                raise ValueError("The expanded DOCX exceeds the size limit.")

            if any(entry.flag_bits & 1 for entry in entries):
                raise ValueError("Encrypted DOCX files are not supported.")

            required = {"[Content_Types].xml", "word/document.xml"}
            if not required.issubset(names):
                raise ValueError("The file is not a valid DOCX.")

    except BadZipFile as error:
        raise ValueError("The file is not a valid DOCX.") from error
