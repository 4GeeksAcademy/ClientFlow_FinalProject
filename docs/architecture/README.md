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
