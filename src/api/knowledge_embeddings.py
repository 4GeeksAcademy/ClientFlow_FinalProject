"""Validate responses from the private embeddings service."""

import json
import math
import os
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class EmbeddingServiceError(RuntimeError):
    """Report an embeddings failure without exposing private data."""


def validate_embeddings(data, expected_count, model, dimensions):
    if not isinstance(data, dict):
        raise EmbeddingServiceError("Invalid embeddings response.")

    if (
        data.get("model") != model
        or type(data.get("dimensions")) is not int
        or data["dimensions"] != dimensions
    ):
        raise EmbeddingServiceError("Unexpected embedding model or dimensions.")

    vectors = data.get("embeddings")

    if not isinstance(vectors, list) or len(vectors) != expected_count:
        raise EmbeddingServiceError("Unexpected number of embeddings.")

    for vector in vectors:
        if not isinstance(vector, list) or len(vector) != dimensions:
            raise EmbeddingServiceError("Invalid embedding dimensions.")

        for value in vector:
            if type(value) not in (int, float):
                raise EmbeddingServiceError("Invalid embedding value.")

            try:
                finite = math.isfinite(value)
            except OverflowError:
                finite = False

            if not finite:
                raise EmbeddingServiceError("Non-finite embedding value.")

        if not any(value != 0 for value in vector):
            raise EmbeddingServiceError("Empty embedding vector.")

    return vectors

class NoRedirectHandler(HTTPRedirectHandler):
    """Prevent credentials from being forwarded to another address."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_embeddings(texts):
    if not isinstance(texts, list) or not 1 <= len(texts) <= 32:
        raise EmbeddingServiceError("A batch must contain 1–32 texts.")

    if any(
        not isinstance(text, str)
        or not text.strip()
        or len(text) > 8000
        for text in texts
    ):
        raise EmbeddingServiceError("Invalid text in embeddings batch.")

    if sum(len(text) for text in texts) > 64000:
        raise EmbeddingServiceError("Embeddings batch exceeds the size limit.")

    url = os.getenv("KNOWLEDGE_EMBEDDINGS_URL", "").strip()
    key = os.getenv("KNOWLEDGE_EMBEDDINGS_API_KEY", "").strip()
    model = os.getenv("KNOWLEDGE_EMBEDDINGS_MODEL", "").strip()

    try:
        dimensions = int(os.getenv("KNOWLEDGE_EMBEDDINGS_DIMENSIONS", "0"))
        address = urlsplit(url)
        valid_address = (
            address.scheme == "https"
            and bool(address.hostname)
            and address.username is None
            and address.password is None
            and not address.fragment
        )
    except ValueError:
        raise EmbeddingServiceError(
            "Invalid embeddings service configuration."
        ) from None

    if not valid_address or not key or not model or not 1 <= dimensions <= 4096:
        raise EmbeddingServiceError(
            "Embeddings service is not configured correctly."
        )

    try:
        request = Request(
            url,
            data=json.dumps({"texts": texts}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-API-Key": key,
            },
            method="POST",
        )

        opener = build_opener(NoRedirectHandler())
        response_limit = 4 * 1024 * 1024

        with opener.open(request, timeout=40) as response:
            content = response.read(response_limit + 1)

        if len(content) > response_limit:
            raise EmbeddingServiceError("Embeddings response is too large.")

        data = json.loads(content)

    except HTTPError as error:
        status = error.code
        error.close()
        raise EmbeddingServiceError(
            f"Embeddings service returned HTTP {status}."
        ) from None
    except (URLError, OSError, HTTPException):
        raise EmbeddingServiceError(
            "Unable to reach the embeddings service."
        ) from None
    except (ValueError, UnicodeError):
        raise EmbeddingServiceError(
            "Invalid embeddings request or response."
        ) from None

    return validate_embeddings(data, len(texts), model, dimensions)

def generate_embeddings(texts):
    """Generate embeddings in batches while preserving text order."""
    if not isinstance(texts, list) or not texts:
        raise EmbeddingServiceError("At least one text is required.")

    if any(
        not isinstance(text, str)
        or not text.strip()
        or len(text) > 8000
        for text in texts
    ):
        raise EmbeddingServiceError("Invalid text for embedding generation.")

    vectors = []
    batch = []
    batch_characters = 0

    for text in texts:
        if batch and (
            len(batch) >= 32
            or batch_characters + len(text) > 64000
        ):
            vectors.extend(request_embeddings(batch))
            batch = []
            batch_characters = 0

        batch.append(text)
        batch_characters += len(text)

    if batch:
        vectors.extend(request_embeddings(batch))

    return vectors
