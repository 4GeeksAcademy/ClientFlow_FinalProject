# MEMBER-01: team invitations and roles (#21)

## Scope

`/team` provides a Spanish team directory, server-side search and active/inactive filtering, pagination, invitation dialog and role/status editing. The existing sidebar route is preserved. The shared header, language selector and theme selector remain separate tickets.

Only owners and administrators manage members. Administrators cannot manage other administrators, invite/promote administrators or modify owners. Owners can manage administrators. Neither role can modify their own membership or transfer ownership through this API. Managers, agents and technicians cannot access team management. All queries are scoped to the authenticated company.

## Invitations

In local development (`FLASK_DEBUG=1`), invitations are simulated as private JSON files in `.local/invite-outbox/`. Open the latest file locally and copy its `url` into a private browser window to test acceptance. Do not commit or share these files publicly. No real email is sent. Production creation returns 503 until a real delivery integration is configured; simulation satisfies this ticket's send-or-simulate requirement.

The URL uses `/accept-invitation#token=...` so the token is not included in the page request URL sent to the server. It expires after 48 hours. The database stores only its SHA-256 hash. Acceptance atomically consumes it; used, expired, wrong-email and unauthorized-inviter invitations are rejected. The company and role come from the invitation, never from registration input. Changes to the inviter's activation/permissions invalidate their outstanding unauthorized invitations.

New users register from the invitation page; existing users select “Ya tengo una cuenta” and authenticate with the invited email. The temporary authentication session is revoked after acceptance. Both flows direct the user to sign in afterwards. Pending invitations are not represented as active members in the directory.

## API

Authenticated management requests require `Authorization: Bearer <token>` and `X-Company-ID`.

- `GET /api/members?page=1&per_page=20&search=&status=all` lists members. Status supports `all`, `active`, `inactive`.
- `POST /api/members/invitations` accepts `email` and `role`; returns invitation metadata, never the raw token.
- `PATCH /api/members/<membership_id>` accepts `role` and/or boolean `is_active`.
- `POST /api/members/invitations/accept` accepts `token`, with JWT for the invited existing user.
- `POST /api/members/invitations/register` accepts `token`, `first_name`, `last_name`, `password`, `password_confirmation`; no prior session required.

Deactivation affects membership in this company only. Existing JWTs lose access to its tenant-protected endpoints, and `/api/me` excludes the inactive membership. The global user account and memberships in other companies are unchanged.

## Deferred schema migration (#43)

The shared migration must add `company_memberships.is_active`, Boolean NOT NULL, with a true default and backfill existing memberships to true. `MemberInvitation` already exists in the base model. Coordinate the Alembic revision with #43 as agreed; this PR does not generate parallel migrations or run schema changes at application startup.

Existing local SQLite databases need that column before running the updated application. Back up the local database first, then apply:

```sql
ALTER TABLE company_memberships ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
```

Fresh test databases use the updated model. Applying this SQL is a local development step, not a production migration procedure.

## Validation

```bash
AUTH_TEST_DATABASE_URL=sqlite:// PYTHONPATH=src:tests pipenv run python -m unittest discover -s tests -p 'test_*.py'
npm run build
```

Tests cover new/existing account acceptance, expiry, replay, email binding, tenant isolation, role hierarchy, inviter deactivation, existing-session revocation, reactivation, search/filter pagination, invalid payloads and production simulation disabled. The test fixture uses an isolated database and a temporary invitation outbox.
