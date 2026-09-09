# ClientFlow MVP Architecture

This directory is the technical reference for the ClientFlow MVP.

## Documents

- [`mvp-scope.md`](./mvp-scope.md): included modules, boundaries and responsibilities.
- [`system-architecture.md`](./system-architecture.md): application, AI, RAG and omnichannel flows.
- [`database.dbml`](./database.dbml): editable relational data model for dbdiagram.io.

## How to view the database diagram

1. Open [dbdiagram.io](https://dbdiagram.io).
2. Create a new diagram.
3. Paste the content of `database.dbml` into the editor.
4. Export a PNG if a static image is required for the project presentation.

The DBML file is the source of truth. Any SQLAlchemy implementation or database
migration must remain consistent with it.

## Operational model added by MODEL-02

The approved lead, client and job detail views require these persistence areas:

| Entity | Purpose | Company isolation |
| --- | --- | --- |
| `next_actions` | Scheduled follow-ups assigned to a team member | Direct `company_id` |
| `activities` | Chronological audit/history events | Direct `company_id` |
| `attachments` | File and photo metadata; binary files stay in external storage | Direct `company_id` |
| `job_assignments` | Many-to-many team assignment for a job | Mandatory `job_id` to `jobs.company_id` |
| `job_stages` | Ordered execution stages inside a job | Mandatory `job_id` to `jobs.company_id` |
| `job_materials` | Required, ordered and used materials | Mandatory `job_id` to `jobs.company_id` |

`next_actions`, `activities` and `attachments` use optional foreign-key columns
to support several record types. A database check constraint requires exactly
one target on every row, preventing ambiguous or orphaned records.

Job child tables intentionally obtain tenant ownership through their mandatory
`job_id`. Repeating `company_id` there would allow contradictory company values.
Backend queries must join or validate the parent job before reading or writing
these records.
