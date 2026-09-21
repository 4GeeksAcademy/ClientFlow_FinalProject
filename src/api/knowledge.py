"""Company-scoped knowledge document endpoints."""

import hashlib
import os
from pathlib import Path
from datetime import timedelta, timezone
from functools import wraps
from uuid import uuid4

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import update, delete, or_, func

from api.auth import tenant_required
from api.knowledge_upload import MAX_UPLOAD_BYTES, read_upload
from api.models import KnowledgeDocument, KnowledgeChunk, MembershipRole, db, utc_now
from api.knowledge_processing import prepare_document_embeddings, document_path
from api.knowledge_embeddings import EmbeddingServiceError

knowledge = Blueprint("knowledge", __name__)


def document_to_dict(document):
    return {
        "id": document.id,
        "title": document.title,
        "source_type": document.source_type,
        "ingestion_status": document.ingestion_status,
        "can_reprocess": document.ingestion_status != "processing" or document.updated_at.replace(tzinfo=timezone.utc) < utc_now() - timedelta(minutes=30),
        "ingestion_error": document.ingestion_error,
        "chunk_count": db.session.scalar(db.select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.document_id == document.id)),
        "created_at": document.created_at.isoformat(),
    }


@knowledge.get("/knowledge/documents")
@tenant_required
def list_documents():
    try:
        page = int(request.args.get("page", "1"))
        per_page = int(request.args.get("per_page", "20"))
    except ValueError:
        return jsonify(message="Pagination values must be integers."), 400

    if page < 1 or not 1 <= per_page <= 100:
        return jsonify(message="Invalid pagination values."), 400

    statement = (
        db.select(KnowledgeDocument)
        .where(KnowledgeDocument.company_id == g.company_id)
        .order_by(KnowledgeDocument.id.desc())
    )

    pagination = db.paginate(
        statement,
        page=page,
        per_page=per_page,
        error_out=False,
    )

    return jsonify(
        documents=[
            document_to_dict(document)
            for document in pagination.items
        ],
        page=pagination.page,
        per_page=pagination.per_page,
        total=pagination.total,
    ), 200

@knowledge.post("/knowledge/documents")
@tenant_required
def upload_document():
    allowed_roles = {
        MembershipRole.OWNER,
        MembershipRole.ADMIN,
        MembershipRole.MANAGER,
    }

    if g.membership.role not in allowed_roles:
        return jsonify(message="You cannot upload knowledge documents."), 403

    if request.content_length is None:
        return jsonify(message="Content-Length is required."), 411

    if request.content_length > MAX_UPLOAD_BYTES + 1024 * 1024:
        return jsonify(message="The upload request is too large."), 413

    try:
        upload = request.files.get("file")
        content, extension = read_upload(upload)
    except ValueError as error:
        return jsonify(message=str(error)), 400

    title = request.form.get("title", "").strip()
    if not title:
        title = Path(upload.filename).stem.strip()

    if not title or len(title) > 200:
        return jsonify(message="Title must contain 1–200 characters."), 400

    storage_root = Path(
        current_app.config.get("KNOWLEDGE_STORAGE_DIR")
        or os.getenv("KNOWLEDGE_STORAGE_DIR")
        or Path(current_app.root_path).parent / ".local" / "knowledge"
    ).resolve()

    storage_key = f"{g.company_id}/{uuid4().hex}{extension}"
    file_path = (storage_root / storage_key).resolve()
    if not file_path.is_relative_to(storage_root):
        return jsonify(message="Invalid storage directory."), 503
    file_created = False

    try:
        file_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

        descriptor = os.open(
            file_path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
        file_created = True

        with os.fdopen(descriptor, "wb") as output:
            output.write(content)

        document = KnowledgeDocument(
            company_id=g.company_id,
            title=title,
            source_type=extension.lstrip("."),
            storage_key=storage_key,
            checksum=hashlib.sha256(content).hexdigest(),
            ingestion_status="pending",
            uploaded_by_membership_id=g.membership.id,
        )

        db.session.add(document)
        db.session.commit()

    except (OSError, SQLAlchemyError):
        db.session.rollback()

        if file_created:
            try:
                file_path.unlink(missing_ok=True)
            except OSError:
                current_app.logger.exception(
                    "Unable to remove an unsuccessful knowledge upload."
                )

        return jsonify(message="Unable to save the document."), 503

    return jsonify(document=document_to_dict(document)), 201

@knowledge.get("/knowledge/documents/<int:document_id>")
@tenant_required
def get_document(document_id):
    document = db.session.scalar(
        db.select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.company_id == g.company_id,
        )
    )

    if document is None:
        return jsonify(message="Document not found."), 404

    return jsonify(document=document_to_dict(document)), 200


def manager_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if g.membership.role not in {MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MANAGER}:
            return jsonify(message="You cannot manage knowledge documents."), 403
        return fn(*args, **kwargs)
    return wrapped


def scoped_document(document_id):
    return db.session.scalar(db.select(KnowledgeDocument).where(
        KnowledgeDocument.id == document_id,
        KnowledgeDocument.company_id == g.company_id,
    ))


@knowledge.post("/knowledge/documents/<int:document_id>/process")
@tenant_required
@manager_required
def process_document(document_id):
    document = scoped_document(document_id)
    if document is None:
        return jsonify(message="Document not found."), 404
    token = uuid4().hex
    # A stale claim can be recovered after a worker crash. Token checks fence old workers.
    stale = utc_now() - timedelta(minutes=30)
    claimed = db.session.execute(update(KnowledgeDocument).execution_options(synchronize_session="fetch").where(
        KnowledgeDocument.id == document_id,
        KnowledgeDocument.company_id == g.company_id,
        or_(KnowledgeDocument.ingestion_status != "processing", KnowledgeDocument.updated_at < stale),
    ).values(ingestion_status="processing", ingestion_error=None, processing_token=token, updated_at=utc_now()))
    if claimed.rowcount != 1:
        db.session.rollback()
        return jsonify(message="Document is already processing."), 409
    db.session.commit()
    try:
        # Release the read transaction before making network calls.
        db.session.refresh(document)
        db.session.expunge(document)
        db.session.rollback()
        chunks = prepare_document_embeddings(document)
        model = os.getenv("KNOWLEDGE_EMBEDDINGS_MODEL", "").strip()
        finished = db.session.execute(update(KnowledgeDocument).execution_options(synchronize_session="fetch").where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.company_id == g.company_id,
            KnowledgeDocument.processing_token == token,
        ).values(ingestion_status="ready", ingestion_error=None, processing_token=None, updated_at=utc_now()))
        if finished.rowcount != 1:
            db.session.rollback()
            return jsonify(message="Processing claim expired; retry the document."), 409
        db.session.execute(delete(KnowledgeChunk).execution_options(synchronize_session="fetch").where(KnowledgeChunk.document_id == document_id))
        db.session.add_all([KnowledgeChunk(
            document_id=document_id, chunk_index=chunk["chunk_index"], content=chunk["content"],
            embedding=chunk["embedding"], embedding_model=model,
            embedding_dimensions=len(chunk["embedding"]),
        ) for chunk in chunks])
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        # Never persist provider responses, source text, paths or credentials in errors.
        if isinstance(error, EmbeddingServiceError):
            message = "Embedding generation failed. Check the service configuration and try again."
        elif isinstance(error, ValueError):
            message = "The document could not be read. Check its format, text and size."
        else:
            message = "Document processing failed. Check the file and try again."
        db.session.execute(update(KnowledgeDocument).execution_options(synchronize_session="fetch").where(
            KnowledgeDocument.id == document_id, KnowledgeDocument.company_id == g.company_id,
            KnowledgeDocument.processing_token == token,
        ).values(ingestion_status="failed", ingestion_error=message, processing_token=None, updated_at=utc_now()))
        db.session.commit()
        current = scoped_document(document_id)
        return jsonify(message=message, document=document_to_dict(current) if current else None), 422
    return jsonify(document=document_to_dict(scoped_document(document_id))), 200


@knowledge.get("/knowledge/documents/<int:document_id>/chunks")
@tenant_required
def list_chunks(document_id):
    document = scoped_document(document_id)
    if document is None:
        return jsonify(message="Document not found."), 404
    try:
        page = int(request.args.get("page", "1"))
    except ValueError:
        return jsonify(message="Invalid page."), 400
    if page < 1:
        return jsonify(message="Invalid page."), 400
    result = db.paginate(db.select(KnowledgeChunk).where(
        KnowledgeChunk.document_id == document_id,
    ).order_by(KnowledgeChunk.chunk_index), page=page, per_page=20, error_out=False)
    return jsonify(chunks=[{
        "id": item.id, "document_id": item.document_id, "chunk_index": item.chunk_index,
        "content": item.content, "embedding_model": item.embedding_model,
        "embedding_dimensions": item.embedding_dimensions,
    } for item in result.items], page=result.page, per_page=20, total=result.total)


@knowledge.delete("/knowledge/documents/<int:document_id>")
@tenant_required
@manager_required
def delete_document(document_id):
    document = scoped_document(document_id)
    if document is None:
        return jsonify(message="Document not found."), 404
    # Claim the row atomically so a processor cannot start while the file is removed.
    claim = db.session.execute(update(KnowledgeDocument).execution_options(synchronize_session="fetch").where(
        KnowledgeDocument.id == document_id, KnowledgeDocument.company_id == g.company_id,
        or_(KnowledgeDocument.ingestion_status != "processing",
            KnowledgeDocument.updated_at < utc_now() - timedelta(minutes=30)),
    ).values(ingestion_status="deleting", processing_token=None))
    if claim.rowcount != 1:
        db.session.rollback()
        return jsonify(message="Wait for processing to finish before deleting."), 409
    original = temporary = None
    try:
        original = document_path(document)
        if original.exists():
            temporary = original.with_name(original.name + ".deleting-" + uuid4().hex)
            original.rename(temporary)
        db.session.delete(document)
        db.session.commit()
    except (OSError, ValueError, SQLAlchemyError):
        db.session.rollback()
        if temporary and temporary.exists():
            temporary.rename(original)
        return jsonify(message="Unable to delete the document."), 503
    if temporary:
        try:
            temporary.unlink()
        except OSError:
            current_app.logger.error("Unable to remove a knowledge deletion tombstone.")
    return jsonify(message="Document deleted."), 200
