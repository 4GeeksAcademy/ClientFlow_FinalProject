# Agenda: local development and Codespaces

The calendar uses the authenticated company, real clients and active team members. Create a client first if the selection is empty. Editing a booking allows moving its date/time; overlapping active bookings for the same responsible member return HTTP 409. Cancelling retains the history. Dates are sent as UTC instants and displayed in the browser timezone.

## Codespaces

Use the same origin for browser API calls through the Vite development proxy. In the private `.env`, replace YOUR-CODESPACE with the actual name shown in the Ports tab:

```ini
VITE_BACKEND_URL=https://YOUR-CODESPACE-3000.app.github.dev
FRONTEND_ORIGIN=https://YOUR-CODESPACE-3000.app.github.dev
AUTH_RESET_URL=https://YOUR-CODESPACE-3000.app.github.dev/reset-password
VITE_USE_MOCK_API=false
```

Start the backend in one terminal:

```bash
pipenv run flask run --host 0.0.0.0 --port 3001
```

Start the frontend in a second terminal:

```bash
npm run dev -- --host 0.0.0.0
```

Open the forwarded port 3000. Vite forwards `/api` to Flask on port 3001 inside the Codespace; the backend port need not be made public. Restart Vite and Flask after changing environment values. Keep the backend JWT secret and database configuration in `.env`; never commit them. Use the project's existing database setup procedure; these corrections introduce no schema migration.

Check `https://YOUR-CODESPACE-3000.app.github.dev/api/health` first. A proxy connection error means Flask is not listening on port 3001. A successful health response with empty client or plan lists means the database needs the relevant development data, not a CORS wildcard.

## Local Mac

The same proxy can be used with `VITE_BACKEND_URL=http://localhost:3000` and `FRONTEND_ORIGIN=http://localhost:3000`. The existing direct backend setting `http://localhost:3001` also works with the matching frontend origin allowlist.

## Acceptance checks

- Create a booking with a real client and responsible member.
- Edit its date and time, then reload to verify persistence.
- Attempt a conflicting booking for the same member; expect a clear warning.
- Cancel a booking and confirm its cancelled status remains visible.
- Verify month/week navigation and local time display.
- Requests for another company must be rejected.

Automated regression tests cover create/move/cancel, conflicts including reactivation, invalid input, UTC normalization, company-scoped options and date ranges. PostgreSQL concurrency and an authenticated visual check in a real Codespace still require environment validation.
