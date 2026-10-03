"""Tenant-scoped AI drafts, human decisions and traceable audit events."""
from functools import wraps

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError

from api.auth import tenant_required
from api.ai_orchestration import generate_reply_draft
from api.models import (db, AIAgent, AIReplyDraft, AIReplyAudit, Conversation,
                        Company, KnowledgeDocument, KnowledgeChunk, agent_documents,
                        Message, MessageDirection, utc_now)

ai = Blueprint('ai', __name__)


def operator_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if g.membership.role.value not in ('owner', 'admin', 'manager', 'agent'):
            return jsonify(message='AI operations require an operator role.'), 403
        return fn(*args, **kwargs)
    return wrapped


def draft_json(draft):
    return {'id': draft.id, 'conversation_id': draft.conversation_id,
            'status': draft.status, 'reply': draft.reply, 'sources': draft.sources,
            'reason': draft.reason, 'message_id': draft.message_id,
            'requires_approval': True, 'created_at': draft.created_at.isoformat()}


def audit(draft, action):
    db.session.add(AIReplyAudit(company_id=g.company_id, draft_id=draft.id,
                               membership_id=g.membership.id, action=action))


def conversation_row(identifier):
    return db.session.scalar(select(Conversation).where(
        Conversation.id == identifier, Conversation.company_id == g.company_id))


def latest_message(identifier):
    return db.session.scalar(select(func.max(Message.id)).where(Message.conversation_id == identifier))


@ai.get('/ai/agents')
@tenant_required
@operator_required
def list_agents():
    agents = db.session.scalars(select(AIAgent).where(AIAgent.company_id == g.company_id, AIAgent.is_active.is_(True))).all()
    return jsonify(agents=[{'id': a.id, 'name': a.name, 'purpose': a.purpose, 'main_instruction': a.main_instruction, 'document_ids': [d.id for d in a.knowledge_documents if d.company_id == g.company_id]} for a in agents])


@ai.get('/conversations/<int:identifier>/ai-drafts')
@tenant_required
@operator_required
def list_drafts(identifier):
    if conversation_row(identifier) is None:
        return jsonify(message='Conversation not found.'), 404
    rows = db.session.scalars(select(AIReplyDraft).where(
        AIReplyDraft.company_id == g.company_id, AIReplyDraft.conversation_id == identifier
    ).order_by(AIReplyDraft.id.desc()).limit(20)).all()
    return jsonify(drafts=[draft_json(d) for d in rows])


@ai.post('/conversations/<int:identifier>/ai-drafts')
@tenant_required
@operator_required
def generate_draft(identifier):
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {'question'}:
        return jsonify(message='Provide a question.'), 400
    conversation = conversation_row(identifier)
    if conversation is None:
        return jsonify(message='Conversation not found.'), 404
    agent_id = conversation.ai_agent_id
    agent = db.session.get(AIAgent, agent_id) if agent_id else None
    instruction = agent.main_instruction if agent else ''
    base = latest_message(identifier)
    try:
        result = generate_reply_draft(g.company_id, identifier, body['question'])
    except ValueError:
        return jsonify(message='Check the question and assigned active agent.'), 400
    # Re-read after the remote call; drafts can never bypass human control changes.
    db.session.expire_all()
    conversation = conversation_row(identifier)
    if conversation is None or conversation.ai_agent_id != agent_id or latest_message(identifier) != base:
        return jsonify(message='Conversation changed. Generate a new draft.'), 409
    draft = AIReplyDraft(company_id=g.company_id, conversation_id=identifier,
                         agent_id=agent_id, agent_instruction=instruction, requested_by=g.membership.id,
                         based_on_message_id=base, status=result['status'], reply=result['reply'],
                         sources=result['sources'], reason=result['reason'])
    db.session.add(draft)
    db.session.flush()
    audit(draft, 'generated' if draft.status == 'pending_review' else 'handoff')
    if draft.status == 'handoff':
        conversation.ai_agent_id = None
    db.session.commit()
    return jsonify(draft=draft_json(draft)), 201


@ai.post('/ai/drafts/<int:identifier>/decision')
@tenant_required
@operator_required
def decide_draft(identifier):
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {'action'} or body['action'] not in ('approve', 'reject'):
        return jsonify(message='Choose approve or reject.'), 400
    # Serialize decisions so repeated approval cannot create duplicate messages.
    db.session.execute(update(Company).where(Company.id == g.company_id).values(updated_at=Company.updated_at))
    draft = db.session.scalar(select(AIReplyDraft).where(AIReplyDraft.id == identifier, AIReplyDraft.company_id == g.company_id))
    if draft is None:
        db.session.rollback()
        return jsonify(message='Draft not found.'), 404
    if draft.status != 'pending_review':
        db.session.rollback()
        return jsonify(message='Draft has already been handled.'), 409
    conversation = conversation_row(draft.conversation_id)
    if body['action'] == 'reject':
        draft.status = 'rejected'
        conversation.ai_agent_id = None
    else:
        agent = db.session.scalar(select(AIAgent).where(AIAgent.id == draft.agent_id,
            AIAgent.company_id == g.company_id, AIAgent.is_active.is_(True)))
        if agent is None or agent.main_instruction != draft.agent_instruction or conversation.ai_agent_id != draft.agent_id or latest_message(conversation.id) != draft.based_on_message_id:
            db.session.rollback()
            return jsonify(message='Conversation changed. Generate a new draft.'), 409
        # Recheck source access and content: revoked/reprocessed documents invalidate drafts.
        for source in draft.sources:
            chunk = db.session.scalar(select(KnowledgeChunk).join(KnowledgeDocument).join(
                agent_documents, agent_documents.c.document_id == KnowledgeDocument.id).where(
                KnowledgeChunk.id == source['chunk_id'], KnowledgeDocument.company_id == g.company_id,
                KnowledgeDocument.ingestion_status == 'ready', agent_documents.c.agent_id == draft.agent_id))
            if chunk is None or chunk.content != source['content']:
                db.session.rollback()
                return jsonify(message='Knowledge changed. Generate a new draft.'), 409
        message = Message(conversation_id=conversation.id, direction=MessageDirection.OUTBOUND,
                          content=draft.reply, content_type='text', sent_by_ai=True, delivery_status='stored')
        db.session.add(message)
        db.session.flush()
        draft.message_id = message.id
        draft.status = 'approved'
        conversation.last_message_at = utc_now()
    audit(draft, draft.status)
    db.session.commit()
    return jsonify(draft=draft_json(draft))


@ai.get('/ai/drafts/<int:identifier>/audit')
@tenant_required
@operator_required
def draft_audit(identifier):
    draft = db.session.scalar(select(AIReplyDraft).where(AIReplyDraft.id == identifier, AIReplyDraft.company_id == g.company_id))
    if draft is None:
        return jsonify(message='Draft not found.'), 404
    events = db.session.scalars(select(AIReplyAudit).where(AIReplyAudit.draft_id == identifier,
        AIReplyAudit.company_id == g.company_id).order_by(AIReplyAudit.id)).all()
    return jsonify(events=[{'action': e.action, 'membership_id': e.membership_id, 'created_at': e.created_at.isoformat()} for e in events])


@ai.errorhandler(SQLAlchemyError)
def database_failure(error):
    db.session.rollback()
    return jsonify(message='AI storage unavailable. Check the database setup.'), 503


@ai.post('/ai/agents')
@tenant_required
@operator_required
def save_agent():
    import os
    if g.membership.role.value not in ('owner', 'admin', 'manager'):
        return jsonify(message='Agent configuration requires a manager.'), 403
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) - {'id', 'name', 'purpose', 'main_instruction', 'document_ids'}:
        return jsonify(message='Invalid agent configuration.'), 400
    for key, maximum in [('name',120), ('purpose',120), ('main_instruction',1500)]:
        if not isinstance(body.get(key), str) or not 1 <= len(body[key].strip()) <= maximum:
            return jsonify(message='Invalid agent configuration.'), 400
    ids = body.get('document_ids')
    if not isinstance(ids,list) or len(ids)>100 or any(type(i) is not int for i in ids):
        return jsonify(message='Select company documents.'),400
    documents = db.session.scalars(select(KnowledgeDocument).where(
        KnowledgeDocument.id.in_(ids), KnowledgeDocument.company_id == g.company_id,
        KnowledgeDocument.ingestion_status == 'ready')).all()
    if len(documents) != len(set(ids)):
        return jsonify(message='Document not available in this company.'),400
    if 'id' in body:
        if type(body['id']) is not int:
            return jsonify(message='Invalid agent.'),400
        agent = db.session.scalar(select(AIAgent).where(AIAgent.id==body['id'],AIAgent.company_id==g.company_id))
        if agent is None:
            return jsonify(message='Agent not found.'),404
    else:
        agent=AIAgent(company_id=g.company_id)
        db.session.add(agent)
    for key in ('name','purpose','main_instruction'):
        setattr(agent,key,body[key].strip())
    agent.model_name=os.getenv('AI_SERVICE_MODEL','qwen2.5:3b')
    agent.requires_human_approval=True
    agent.is_active=True
    agent.knowledge_documents=documents
    db.session.commit()
    return jsonify(id=agent.id),201
