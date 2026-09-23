# Knowledge documents (#31)

The `/knowledge` page is in Spanish and uses the real Flask API. Upload PDF,
DOCX or UTF-8 TXT (10 MiB maximum). The upload is stored as `pending`; the UI
then calls the processing endpoint. The list refreshes every five seconds.
PDFs must contain text: OCR and encrypted PDFs are not supported.

## Backend configuration

Set these only in the backend environment; never use `VITE_*` for credentials:

- `KNOWLEDGE_EMBEDDINGS_URL`: HTTPS URL of the private `/v1/embeddings` endpoint.
- `KNOWLEDGE_EMBEDDINGS_API_KEY`: service credential issued for this backend.
- `KNOWLEDGE_EMBEDDINGS_MODEL=embeddinggemma`
- `KNOWLEDGE_EMBEDDINGS_DIMENSIONS=768`
- Optional `KNOWLEDGE_STORAGE_DIR`: private persistent filesystem directory.
  Default: repository `.local/knowledge`.

The backend must reach the private service (e.g. the authorized Tailscale network).
A Codespace/deployment does not automatically have access to a developer's tailnet.
Ollama is not exposed directly. The endpoint accepts at most 32 texts / 64,000
characters, with 8,000 characters per text, and returns ordered embeddings.
Requests use a 40-second socket timeout, reject redirects, limit the response to
4 MiB and validate model, dimensions, count, numeric finite values and nonzero
vectors. No source content or provider error body is included in error messages.

The configured credential authenticates a **stateless embedding computation**.
It is not the identity of a ClientFlow company. ClientFlow derives the company
from verified JWT membership on every endpoint. No remote tenant ID is accepted
from the browser, and the provider must not persist texts, vectors or history.
Do not reuse this single credential design for remote tenant-specific RAG or memory.

## Persistence and concurrency

Sources use random filenames under a company directory with 0600 permissions.
Normalized text is divided into 1,200-character chunks with 200-character overlap
(maximum extracted text: 500,000 characters). Character counts are not token
counts; `token_count` remains unset. DOCX archive size and entry count are bounded.

`KnowledgeChunk.embedding` stores JSON numeric vectors, alongside
`embedding_model` and `embedding_dimensions`. JSON works in the project's local
SQLite and PostgreSQL setup; this ticket does not introduce vector indexing or
RAG retrieval. Each chunk belongs to its source document, which owns company scope.
`embedding_reference` remains available for future external storage and is unused.
Consumers must restrict retrieval to `ingestion_status=ready` and a matching model.

Processing statuses: `pending`, `processing`, `ready`, `failed`.
`ingestion_error` contains a safe failure summary. An atomic claim and random
`processing_token` prevent concurrent processing/deletion. After 30 minutes a
stale job can be retried; an old worker cannot commit over the new claim.
A complete replacement is committed atomically. Failed reprocessing preserves
previous chunks but marks the document failed, so it must not be served by RAG.

Processing is synchronous. Configure production worker/proxy request timeouts for
large documents (up to 500 chunks / 16 batches), or add a job queue in a separate
infrastructure change. A browser disconnect does not reliably cancel server work;
refresh the list before retrying. There is no permanent background worker here.
Deletion removes chunks, agent associations and the source file; a temporary
file rename allows recovery if the database transaction fails. A crash or final
filesystem cleanup failure can leave a private `.deleting-*` tombstone requiring
operator cleanup. Application endpoints no longer expose a deleted document.

## API

All routes use `/api/knowledge/documents`, bearer JWT and `X-Company-ID`.
Active company membership and subscription are required.

| Method | Suffix | Behavior |
| --- | --- | --- |
| GET | `?page=1&per_page=20` | Company-scoped list, status, error and chunk count |
| POST | empty | Multipart `file`, optional `title`; owner/admin/manager only |
| GET | `/{id}` | Company-scoped document metadata |
| POST | `/{id}/process` | Process/reprocess; owner/admin/manager only |
| GET | `/{id}/chunks?page=1` | Text preview, 20 chunks/page; no raw vectors |
| DELETE | `/{id}` | Remove document; owner/admin/manager only |

Foreign-company IDs return 404. In-progress mutations return 409. Unreadable
sources/provider failures return 422 with a persisted safe error. Upload errors
return 400/413. No endpoint exposes storage paths or credentials.

## Schema handoff to #43

The professor deferred shared migrations to the coordinated migration ticket.
This PR adds model fields but does not generate/rewrite shared Alembic history:

- `knowledge_documents.ingestion_error`: nullable Text.
- `knowledge_documents.processing_token`: nullable String(64).
- `knowledge_chunks.embedding`: nullable JSON.
- `knowledge_chunks.embedding_model`: nullable String(100).
- `knowledge_chunks.embedding_dimensions`: nullable Integer.

All are nullable for existing rows. Existing chunks without embeddings must be
reprocessed. **Existing shared/PostgreSQL databases need these columns applied by
#43 before deploying this code.** A fresh database created from metadata includes
them. Do not use `create_all()` to upgrade existing databases.

For the established local demo only:

```sh
python3.13 scripts/knowledge_local_schema.py
```

This only opens `.local/auth-demo.db`, requires both existing tables, backs up
before changes, and adds missing columns transactionally. It is idempotent and
is not a deployment migration. It never resets data or touches PostgreSQL.

## Validation

```sh
AUTH_TEST_DATABASE_URL=sqlite:// PYTHONPATH=src:tests pipenv run python -m unittest discover -s tests -p 'test_*.py'
node --test tests/frontend/*.test.mjs
npm run build
```

Knowledge tests use a disposable database and mocked embeddings. They cover
upload validation, text extraction, tenant/role restrictions, ordered batches,
invalid vectors, failure recovery, stale claims, reprocessing and deletion.
A real private-service smoke test also used synthetic TXT input with a disposable
DB and confirmed upload → 768-dimensional persisted vectors → reprocess → delete.
