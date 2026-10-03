"""Browser-based plan setup for environments without shell access."""

import hmac
import os

from flask import make_response, render_template_string, request
from sqlalchemy.exc import SQLAlchemyError

from api.models import db
from api.plan_commands import create_missing_plans

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClientFlow — Plan setup</title></head>
<body><main><h1>ClientFlow — Plan setup</h1>
<p>Create missing subscription plans. Existing plans and prices are preserved.</p>
<p>This does not create database tables or restore deleted accounts.</p>
{% if message %}<p role="status">{{ message }}</p>{% endif %}
{% if enabled %}
<form method="post">
<label for="setup-key">Setup key</label>
<input id="setup-key" name="setup_key" type="password" required
 minlength="32" maxlength="512" autocomplete="off">
<button type="submit">Create plans</button>
</form>
{% else %}<p>Browser setup is disabled. Configure PLAN_SEED_KEY on the server.</p>{% endif %}
</main></body></html>"""


def register_plan_setup(api):
    @api.route("/seed-plans", methods=["GET", "POST"])
    def browser_seed_plans():
        key = os.getenv("PLAN_SEED_KEY", "")
        enabled = 32 <= len(key) <= 512
        message = ""
        status = 200
        if request.method == "POST":
            if not enabled:
                status, message = 503, "Browser setup is disabled."
            elif request.content_length is None or request.content_length > 4096:
                status, message = 413, "Invalid form size."
            else:
                supplied = request.form.get("setup_key", "")
                if not supplied or len(supplied) > 512 or not hmac.compare_digest(
                    supplied.encode("utf-8"), key.encode("utf-8")
                ):
                    status, message = 403, "Invalid setup key."
                else:
                    try:
                        created = create_missing_plans()
                        message = ("Created plans: " + ", ".join(created) + "."
                                   if created else "All plans already exist. No changes made.")
                    except SQLAlchemyError:
                        db.session.rollback()
                        status, message = 503, "Could not prepare plans. Check database setup and retry."
        response = make_response(render_template_string(
            PAGE, enabled=enabled, message=message
        ), status)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
        )
        return response
