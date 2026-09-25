"""Retrieve company knowledge authorized for an AI agent."""

import math
import os

from sqlalchemy import select

from api.knowledge_embeddings import request_embeddings
from api.models import (
    AIAgent,
    KnowledgeChunk,
    KnowledgeDocument,
    agent_documents,
    db,
)


def authorized_chunks(company_id, agent_id):
    """Load ready chunks explicitly assigned to this company's agent."""
    query = (
        select(KnowledgeChunk)
        .join(
            KnowledgeDocument,
            KnowledgeChunk.document_id == KnowledgeDocument.id,
        )
        .join(
            agent_documents,
            agent_documents.c.document_id == KnowledgeDocument.id,
        )
        .join(
            AIAgent,
            AIAgent.id == agent_documents.c.agent_id,
        )
        .where(
            AIAgent.id == agent_id,
            AIAgent.company_id == company_id,
            AIAgent.is_active.is_(True),
            KnowledgeDocument.company_id == company_id,
            KnowledgeDocument.ingestion_status == "ready",
            KnowledgeChunk.embedding.is_not(None),
        )
        .order_by(KnowledgeChunk.id)
    )

    return db.session.scalars(query).all()


def cosine_similarity(left, right):
    """Compare two valid embedding vectors."""
    if not left or not right or len(left) != len(right):
        raise ValueError("Embedding dimensions must match.")

    for vector in (left, right):
        if any(
            type(value) not in (int, float) or not math.isfinite(value)
            for value in vector
        ):
            raise ValueError("Embeddings must contain finite numbers.")

    left_norm = math.hypot(*left)
    right_norm = math.hypot(*right)

    if (
        not math.isfinite(left_norm)
        or not math.isfinite(right_norm)
        or left_norm == 0
        or right_norm == 0
    ):
        raise ValueError("Invalid embedding magnitude.")

    score = math.fsum(
        (a / left_norm) * (b / right_norm) for a, b in zip(left, right, strict=True)
    )

    return max(-1.0, min(1.0, score))


def rank_chunks(chunks, query_vector, model, limit=5):
    """Rank compatible authorized chunks by similarity."""
    if type(limit) is not int or not 1 <= limit <= 10:
        raise ValueError("Limit must be between 1 and 10.")

    cosine_similarity(query_vector, query_vector)
    ranked = []

    for chunk in chunks:
        if chunk.embedding_model != model or chunk.embedding_dimensions != len(
            query_vector
        ):
            continue

        try:
            score = cosine_similarity(query_vector, chunk.embedding)
        except (ValueError, TypeError, OverflowError):
            continue

        ranked.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "score": score,
            }
        )

    ranked.sort(key=lambda item: (-item["score"], item["chunk_id"]))

    return ranked[:limit]


def retrieve_knowledge(company_id, agent_id, question, limit=5):
    """Find authorized knowledge relevant to a question."""
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question is required.")

    question = question.strip()

    if len(question) > 4000:
        raise ValueError("Question exceeds the size limit.")

    if type(limit) is not int or not 1 <= limit <= 10:
        raise ValueError("Limit must be between 1 and 10.")

    chunks = authorized_chunks(company_id, agent_id)

    if not chunks:
        return []

    model = os.getenv("KNOWLEDGE_EMBEDDINGS_MODEL", "").strip()
    query_vector = request_embeddings([question])[0]

    return rank_chunks(chunks, query_vector, model, limit)
