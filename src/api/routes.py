"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import Blueprint, Flask, jsonify, request, url_for
from flask_cors import CORS
from sqlalchemy import select

from api.models import Plan, User, db
from api.utils import APIException, generate_sitemap

api = Blueprint('api', __name__)

# Allow CORS requests to this API
CORS(api)


@api.route('/hello', methods=['POST', 'GET'])
def handle_hello():

    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }

    return jsonify(response_body), 200
@api.route('/health', methods=['GET'])
def health_check():

    response_body = {
        "status": "ok"
    }

    return jsonify(response_body), 200


@api.route('/plans', methods=['GET'])
def get_plans():
    plans = db.session.scalars(
        select(Plan)
        .where(Plan.is_active.is_(True))
        .order_by(Plan.id)
    ).all()

    return jsonify([
        {
            "id": plan.id,
            "code": plan.code,
            "name": plan.name,
            "description": plan.description,
            "price_eur": str(plan.price_eur),
            "billing_interval": plan.billing_interval,
            "trial_days": plan.trial_days,
            "limits": plan.limits,
        }
        for plan in plans
    ]), 200
