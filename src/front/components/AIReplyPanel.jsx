import {useEffect, useState} from 'react';
import {aiRequest} from '../services/aiService';
import {inboxService} from '../services/inboxService';

export function AIReplyPanel({conversationId, token, companyId, onChanged}) {
    const [agents, setAgents] = useState([]);
    const [agentId, setAgentId] = useState('');
    const [question, setQuestion] = useState('');
    const [drafts, setDrafts] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const options = {token, companyId};
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            aiRequest('/ai/agents', {...options, signal:controller.signal}),
            aiRequest(`/conversations/${conversationId}/ai-drafts`, {...options, signal:controller.signal}),
        ]).then(([a,d]) => {setAgents(a.agents); setDrafts(d.drafts);}).catch(e => {
            if (!controller.signal.aborted) setError(e.message);
        });
        return () => controller.abort();
    }, [conversationId, token, companyId, revision]);
    async function run(action) {
        setBusy(true); setError('');
        try {await action(); setRevision(v=>v+1); onChanged();}
        catch(e) {setError(e.message);}
        finally {setBusy(false);}
    }
    return <section className="p-3 border-top" aria-label="Asistente IA">
        <strong>Asistente IA · revisión humana obligatoria</strong>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="d-flex gap-2 my-2">
            <select aria-label="Agente" className="form-select" value={agentId} onChange={e=>setAgentId(e.target.value)} disabled={busy}>
                <option value="">Seleccionar agente</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className="btn btn-outline-primary" disabled={busy || !agentId} onClick={()=>run(()=>inboxService.updateControl(conversationId,'ai',Number(agentId),options))}>Asignar</button>
        </div>
        {!agents.length && <p>Configura un agente en Agentes IA y vincula documentos procesados.</p>}
        <textarea className="form-control" aria-label="Pregunta para el agente" placeholder="Pregunta del cliente que quieres responder" maxLength={4000} value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy}/>
        <button className="btn btn-primary my-2" disabled={busy || !question.trim()} onClick={()=>run(()=>aiRequest(`/conversations/${conversationId}/ai-drafts`,options,{question}))}>{busy?'Procesando…':'Generar borrador'}</button>
        {drafts.map(d=><article className="border rounded p-2 my-2" key={d.id}>
            <strong>{{pending_review:'Pendiente de revisión',approved:'Aprobado · guardado en la conversación',rejected:'Rechazado',handoff:'Requiere atención humana'}[d.status]}</strong>
            {d.reply && <p style={{whiteSpace:'pre-wrap'}}>{d.reply}</p>}
            {d.status==='handoff' && <p>No se envió ninguna respuesta. Revisa las fuentes o la conexión y continúa el atención manualmente.</p>}
            {d.sources.map(s=><details key={s.chunk_id}><summary>Documento {s.document_id} · fragmento {s.chunk_index+1}</summary><p>{s.content}</p></details>)}
            {d.status==='pending_review' && <div className="d-flex gap-2 mt-2">
                <button className="btn btn-success" disabled={busy} onClick={()=>run(()=>aiRequest(`/ai/drafts/${d.id}/decision`,options,{action:'approve'}))}>Aprobar respuesta</button>
                <button className="btn btn-outline-danger" disabled={busy} onClick={()=>run(()=>aiRequest(`/ai/drafts/${d.id}/decision`,options,{action:'reject'}))}>Rechazar y atender</button>
            </div>}
        </article>)}
    </section>;
}
