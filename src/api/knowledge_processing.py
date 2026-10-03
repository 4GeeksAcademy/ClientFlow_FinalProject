"""Read stored knowledge documents and prepare their text chunks."""

from pathlib import Path
import os

from flask import current_app

from api.knowledge_embeddings import generate_embeddings
from api.knowledge_text import extract_text, split_text
from api.knowledge_upload import MAX_UPLOAD_BYTES

MAX_TEXT_CHARACTERS = 500_000


def prepare_document_chunks(document):
    file_path = document_path(document)

    try:
        with file_path.open("rb") as source:
            content = source.read(MAX_UPLOAD_BYTES + 1)
    except OSError as error:
        raise ValueError("The stored document could not be read.") from error

    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("The stored document exceeds the size limit.")

    text = extract_text(content, file_path.suffix.lower())

    if len(text) > MAX_TEXT_CHARACTERS:
        raise ValueError("The extracted text exceeds the processing limit.")

    return split_text(text)

def prepare_document_embeddings(document):
    """Pair each source chunk with its generated embedding."""
    texts = prepare_document_chunks(document)
    vectors = generate_embeddings(texts)

    return [
        {
            "chunk_index": index,
            "content": text,
            "embedding": vector,
        }
        for index, (text, vector) in enumerate(
            zip(texts, vectors, strict=True)
        )
    ]


def document_path(document):
    storage_root = Path(
        current_app.config.get("KNOWLEDGE_STORAGE_DIR")
        or os.getenv("KNOWLEDGE_STORAGE_DIR")
        or Path(current_app.root_path).parent / ".local" / "knowledge"
    ).resolve()

    if not document.storage_key:
        raise ValueError("The document has no stored file.")

    company_root = (storage_root / str(document.company_id)).resolve()
    file_path = (storage_root / document.storage_key).resolve()

    if (
        not company_root.is_relative_to(storage_root)
        or not file_path.is_relative_to(company_root)
    ):
        raise ValueError("Invalid document storage path.")

    return file_path
