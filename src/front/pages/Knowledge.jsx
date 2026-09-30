import { useEffect, useRef, useState } from "react";
import { knowledgeService } from "../services/knowledgeService";
import "../styles/knowledge.css";
import { useLanguage } from "../context/LanguageContext";

export const Knowledge = () => {
    const { locale, ui } = useLanguage();
    const errorMessage = (failure) => failure instanceof TypeError ? ui.connectionError : failure.message;
    const labels = { pending: ui.pending, processing: ui.processing, ready: ui.ready, failed: ui.failed };
    const token = localStorage.getItem("access_token");
    const [company, setCompany] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [preview, setPreview] = useState(null);
    const [chunkPage, setChunkPage] = useState(1);
    const [history, setHistory] = useState(null);
    const dialog = useRef(null);
    const active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
                const response = await fetch(`${base}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
                });
                if (!response.ok) throw new Error(ui.accountLoadError);
                const account = await response.json();
                const current = account.companies?.[0];
                if (!current) throw new Error(ui.noCompany);
                const result = await knowledgeService.list({ token, companyId: current.id, signal: controller.signal }, page);
                if (controller.signal.aborted) return;
                setCompany(current); setDocuments(result.documents); setTotal(result.total);
                if (page > 1 && !result.documents.length) setPage(1);
            } catch (failure) {
                if (!controller.signal.aborted) setError(errorMessage(failure));
            } finally { if (!controller.signal.aborted) setLoading(false); }
        }
        load();
        const timer = window.setInterval(load, 5000);
        return () => { controller.abort(); window.clearInterval(timer); };
    }, [token, page, revision, ui.accountLoadError, ui.noCompany]);

    useEffect(() => {
        if (!preview || !company) return;
        const controller = new AbortController();
        setHistory(null);
        knowledgeService.chunks({ token, companyId: company.id, signal: controller.signal }, preview.id, chunkPage)
            .then((data) => { if (!controller.signal.aborted) setHistory(data); })
            .catch((failure) => { if (!controller.signal.aborted) setHistory({ error: errorMessage(failure) }); });
        return () => controller.abort();
    }, [preview, chunkPage, company?.id, token]);

    const canManage = ["owner", "admin", "manager"].includes(company?.role);
    const options = { token, companyId: company?.id };
    const refresh = () => setRevision((value) => value + 1);
    async function perform(action, message) {
        if (busy) return;
        setBusy(true); setError(""); setNotice("");
        try {
            await action();
            if (active.current) setNotice(message);
        } catch (failure) {
            if (active.current) setError(errorMessage(failure) || ui.connectionError);
        } finally {
            if (active.current) { setBusy(false); refresh(); }
        }
    }
    function upload(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const file = data.get("file");
        if (!file?.size || file.size > 10 * 1024 * 1024 || !/\.(pdf|docx|txt)$/i.test(file.name)) {
            setError(ui.invalidKnowledgeFile); return;
        }
        perform(async () => {
            const result = await knowledgeService.upload(options, data);
            if (active.current) { form.reset(); dialog.current.close(); setNotice(ui.documentProcessing); refresh(); }
            await knowledgeService.process(options, result.document.id);
        }, ui.documentProcessed);
    }

    return <section className="knowledge-page">
        <header className="knowledge-heading"><div>
            <p className="knowledge-eyebrow">CLIENTFLOW{company ? ` · ${company.name}` : ""}</p>
            <h1>{ui.knowledgeTitle}</h1><p>{ui.knowledgeSubtitle}</p>
        </div>{canManage && <button className="knowledge-primary" disabled={busy} onClick={() => dialog.current.showModal()}>+ {ui.uploadDocument}</button>}</header>
        {error && <div className="knowledge-error" role="alert">{error} <button onClick={refresh}>{ui.update}</button></div>}
        {notice && <p className="knowledge-notice" role="status">{notice}</p>}
        {busy && <p role="status">{ui.operationProcessing}</p>}
        <div className="knowledge-card" aria-busy={loading}>
            {loading ? <p className="knowledge-empty">{ui.documentsLoading}</p> : <>
                <div className="knowledge-scroll"><table><thead><tr><th>{ui.document}</th><th>{ui.format}</th><th>{ui.status}</th><th>{ui.chunks}</th><th>{ui.actions}</th></tr></thead>
                    <tbody>{documents.map((document) => <tr key={document.id}>
                        <td><strong>{document.title}</strong><small>{new Date(document.created_at).toLocaleDateString(locale)}</small>
                            {document.ingestion_error && <p className="knowledge-failure">{ui.knowledgeFailure}</p>}</td>
                        <td>{document.source_type.toUpperCase()}</td><td><span className={`knowledge-status ${document.ingestion_status}`}>{labels[document.ingestion_status] || document.ingestion_status}</span></td>
                        <td>{document.chunk_count}</td><td><div className="knowledge-actions">
                            <button disabled={!document.chunk_count} onClick={() => { setPreview(document); setChunkPage(1); }}>{ui.viewText}</button>
                            {canManage && <><button disabled={busy || !document.can_reprocess} onClick={() => perform(() => knowledgeService.process(options, document.id), ui.documentProcessed)}>{document.ingestion_status === "pending" ? ui.process : ui.reprocess}</button>
                                <button disabled={busy || !document.can_reprocess} onClick={() => {
                                    if (window.confirm(ui.deleteDocumentConfirm.replace("{title}", document.title))) perform(() => knowledgeService.remove(options, document.id), ui.documentDeleted);
                                }}>{ui.delete}</button></>}
                        </div></td>
                    </tr>)}</tbody></table></div>
                {!documents.length && <div className="knowledge-empty"><h2>{ui.noDocuments}</h2><p>{ui.noDocumentsHint}</p></div>}
                <footer><span>{ui.documentCount.replace("{count}", total)}</span><div><button disabled={page === 1 || busy} onClick={() => { setLoading(true); setPage(page - 1); }}>{ui.previous}</button><span>{ui.page} {page}</span><button disabled={page * 20 >= total || busy} onClick={() => { setLoading(true); setPage(page + 1); }}>{ui.next}</button></div></footer>
            </>}
        </div>
        {preview && <section className="knowledge-preview"><header><h2>{preview.title}</h2><button onClick={() => setPreview(null)}>{ui.closeText}</button></header>
            {!history ? <p>{ui.textLoading}</p> : history.error ? <p role="alert">{history.error}</p> : <>
                {history.chunks.map((chunk) => <article key={chunk.id}><small>{ui.chunk} {chunk.chunk_index + 1}</small><p>{chunk.content}</p></article>)}
                <footer><button disabled={chunkPage === 1} onClick={() => setChunkPage(chunkPage - 1)}>{ui.previous}</button><span>{ui.page} {chunkPage}</span><button disabled={chunkPage * 20 >= history.total} onClick={() => setChunkPage(chunkPage + 1)}>{ui.next}</button></footer>
            </>}
        </section>}
        <dialog ref={dialog} className="knowledge-dialog" aria-labelledby="knowledge-upload-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
            <form onSubmit={upload}><h2 id="knowledge-upload-title">{ui.uploadDocument}</h2><p>{ui.fileHelp}</p>
                <label>{ui.optionalTitle}<input name="title" maxLength={200} disabled={busy} /></label>
                <label>{ui.file}<input name="file" type="file" accept=".pdf,.docx,.txt" required disabled={busy} /></label>
                {error && <p role="alert" className="knowledge-failure">{error}</p>}
                <div className="knowledge-actions"><button type="button" disabled={busy} onClick={() => dialog.current.close()}>{ui.cancel}</button><button className="knowledge-primary" disabled={busy}>{ui.uploadAndProcess}</button></div>
            </form>
        </dialog>
    </section>;
};
