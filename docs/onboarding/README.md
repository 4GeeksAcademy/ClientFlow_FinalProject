# Onboarding (#24)

Start at `/select-plan`, choose an active plan and either a three-day trial or an academic payment simulation, then register. Registration creates the user, owner membership, company and subscription in one transaction. Sign in after registration.

The simulated payment makes no charge and grants a fixed 30-day academic period, with a `mock_` subscription identifier. It is not a payment-provider integration or calendar-month billing. Trial dates are calculated by the server as exactly three days.

Use `VITE_USE_MOCK_API=false` to connect authentication to the real backend. `GET /api/plans` lists active plans. `POST /api/register` accepts firstName, lastName, email, company, password, plan_id, and registration_mode (`trial` or `mock_payment`, default `trial`). Passwords require 12–128 characters.

All routes decorated with `tenant_required` now require a valid subscription for the verified company. Missing, cancelled and expired subscriptions fail closed with HTTP 403 and code `subscription_required`. `/api/me` remains available for finding memberships. The UI verifies `/api/auth/context` before rendering protected content and rechecks every 30 seconds and on window focus. It currently uses the first company returned by `/api/me`; multi-company selection is outside this ticket.

## Local data

For an EMPTY disposable database, the existing `auth-local-bootstrap` command now also creates a Starter demo plan and a three-day subscription. Follow the debug and bootstrap opt-in instructions in `docs/auth/README.md`. Never run a database reset against existing data. Existing test owners without subscriptions will be denied access; use a newly registered account with an active plan instead. No migration is included: coordinated migrations remain in #43. Existing databases need the team's pending schema updates to exercise newly added lead fields.

## Verification

Run tests against a disposable database only:

```sh
PIPENV_DONT_LOAD_ENV=1 AUTH_TEST_DATABASE_URL=sqlite:// PYTHONPATH=src pipenv run python -m unittest discover -s tests -q
npm run build
```

The onboarding tests cover trial and payment dates, owner creation, expiry using an existing token, inactive plans, invalid input, duplicate email and rollback. Existing authentication and lead fixtures now include valid subscriptions.

Manual checks: register one account per mode, sign in, confirm the protected page opens. Expire a disposable subscription and reload: protected content should be replaced with the subscription message. Payment renewal, real charges, additional catalog pricing and migration integration are outside this ticket.
