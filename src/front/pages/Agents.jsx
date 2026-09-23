import {useEffect, useState} from 'react';
import {aiRequest} from '../services/aiService';

export function Agents() {
    const token = localStorage.getItem('access_token');
    const [company, setCompany] = useState(null);
    const [agents, setAgents] = useState([]);
    const [documents, setDocuments] = useState([]);
    const empty = {name:'', purpose:'Atención al cliente', main_instruction:'Responde con claridad usando únicamente las fuentes de la empresa.', document_ids:[]};
    const [form, setForm] = useState(empty);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(()=>{
        const controller = new AbortController();
        (async()=>{
            const me=await aiRequest('/me',{token,signal:controller.signal});
            const c=me.companies?.[0];
            if(!c) throw new Error('No hay una empresa disponible.');
            const options={token,companyId:c.id,signal:controller.signal};
            const a=await aiRequest('/ai/agents',options);
            const docs=[];
            let page=1;
            while(true) {
                const d=await aiRequest(`/knowledge/documents?page=${page}&per_page=100`,options);
                docs.push(...d.documents);
                if(docs.length>=d.total || !d.documents.length) break;
                page++;
            }
            if(!controller.signal.aborted) {setCompany(c);setAgents(a.agents);setDocuments(docs.filter(d=>d.ingestion_status==='ready'));}
        })().catch(e=>{if(!controller.signal.aborted)setError(e.message);});
        return ()=>controller.abort();
    },[token,revision]);
    async function save(e) {
        e.preventDefault();setBusy(true);setError('');
        try {await aiRequest('/ai/agents',{token,companyId:company.id},form);setForm(empty);setRevision(v=>v+1);}
        catch(e) {setError(e.message);}
        finally {setBusy(false);}
    }
    const canManage=company && ['owner','admin','manager'].includes(company.role);
    return <div className="container py-4"><h1>Agentes IA</h1><p>Configura las instrucciones y el conocimiento de tu empresa. Todas las respuestas requieren revisión humana.</p>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        <div className="row g-4"><div className="col-md-5"><h2>Agentes disponibles</h2>{agents.map(a=><div className="card p-3 mb-2" key={a.id}><strong>{a.name}</strong><p>{a.purpose}</p>{canManage && <button className="btn btn-outline-primary" onClick={()=>setForm({id:a.id,name:a.name,purpose:a.purpose,main_instruction:a.main_instruction,document_ids:a.document_ids})}>Editar configuración</button>}</div>)}</div>
        {canManage && <form className="col-md-7" onSubmit={save}><h2>{form.id?'Editar agente':'Crear agente'}</h2>
            <label className="d-block mb-2">Nombre<input className="form-control" required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
            <label className="d-block mb-2">Función<input className="form-control" required maxLength={120} value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}/></label>
            <label className="d-block mb-2">Instrucciones<textarea className="form-control" required maxLength={1500} rows={5} value={form.main_instruction} onChange={e=>setForm({...form,main_instruction:e.target.value})}/></label>
            <fieldset><legend>Documentos autorizados</legend>{!documents.length && <p>Sube y procesa documentos en Conocimiento primero.</p>}{documents.map(d=><label className="d-block" key={d.id}><input type="checkbox" checked={form.document_ids.includes(d.id)} onChange={e=>setForm({...form,document_ids:e.target.checked?[...form.document_ids,d.id]:form.document_ids.filter(id=>id!==d.id)})}/> {d.title}</label>)}</fieldset>
            <button className="btn btn-primary mt-3" disabled={busy}>{busy?'Guardando…':'Guardar agente'}</button>
        </form>}</div></div>;
}
