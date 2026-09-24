import { useEffect, useRef, useState } from "react";
import { inboxService } from "../services/inboxService";
import "./Inbox.css";
import { AIReplyPanel } from "../components/AIReplyPanel";

const labels = {
    web: "Web", email: "Correo electrónico", whatsapp: "WhatsApp", instagram: "Instagram",
    open: "Abierta", waiting: "En espera", resolved: "Resuelta", human: "Humano", ai: "IA",
    stored: "Guardado", received: "Recibido", sent: "Enviado", delivered: "Entregado", failed: "Fallido",
};
const displayLabel = (value) => labels[value] || value;
const displayError = (error) => ({
    "Take human control before sending a message.": "Asume el control antes de enviar un mensaje.",
    "Conversation not found.": "No se encontró la conversación.",
    "Your subscription is inactive or expired.": "Tu suscripción está inactiva o ha caducado.",
    "Failed to fetch": "No se pudo conectar con el servidor.",
}[error.message] || "No se pudo completar la operación. Inténtalo de nuevo.");

export const Inbox = () => {
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [actionError, setActionError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const selection = useRef(null);
    const token = localStorage.getItem("access_token");
    const [companyId, setCompanyId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [conversationsError, setConversationsError] = useState("");
    const [error, setError] = useState("");
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const [history, setHistory] = useState(null);
    const [messagePage, setMessagePage] = useState(1);
    const [conversationPage, setConversationPage] = useState(1);
    const [conversationTotal, setConversationTotal] = useState(0);
    const [conversationPerPage, setConversationPerPage] = useState(20);

    useEffect(() => {
        const controller = new AbortController();

        const loadCompany = async () => {
            try {
                if (!token) {
                    throw new Error("Inicia sesión para ver las conversaciones.");
                }

                const apiUrl = (
                    import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"
                ).replace(/\/+$/, "");

                const response = await fetch(`${apiUrl}/api/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("No se pudo cargar tu cuenta.");
                }

                const account = await response.json();
                const company = account.companies?.[0];

                if (!company) {
                    throw new Error("No hay ninguna empresa disponible para esta cuenta.");
                }

                if (!controller.signal.aborted) {
                    setCompanyId(company.id);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setError(error.message);
                }
            }
        };

        setCompanyId(null);
        setError("");
        loadCompany();
        return () => controller.abort();
    }, [token]);

    useEffect(() => {
        if (!token || !companyId) return;

        const controller = new AbortController();
        let timeoutId;

        const loadConversations = async () => {
            try {
                const data = await inboxService.listConversations(
                    { token, companyId, signal: controller.signal },
                    conversationPage
                );

                if (!controller.signal.aborted) {
                    setConversations(data.conversations);
                    setConversationTotal(data.total);
                    setConversationPerPage(data.per_page);
                    setConversationsError("");
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setConversationsError(displayError(error));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingConversations(false);
                    timeoutId = window.setTimeout(loadConversations, 5000);
                }
            }
        };
        selection.current = null;
        setDraft("");
        setActionError("");
        setSelectedConversationId(null);
        setMessagePage(1);
        setConversations([]);
        setConversationsError("");
        setLoadingConversations(true);
        loadConversations();

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [token, companyId, conversationPage]);
    useEffect(() => {
        if (!token || !companyId || !selectedConversationId) return;

        const controller = new AbortController();
        let timeoutId;

        const loadMessages = async () => {
            try {
                const data = await inboxService.listMessages(
                    selectedConversationId,
                    { token, companyId, signal: controller.signal },
                    messagePage
                );

                if (!controller.signal.aborted) {
                    setHistory({
                        conversationId: selectedConversationId,
                        messages: data.messages,
                        page: data.page,
                        total: data.total,
                        perPage: data.per_page,
                        error: "",
                    });
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setHistory({
                        conversationId: selectedConversationId,
                        messages: [],
                        page: messagePage,
                        error: displayError(error),
                    });
                }
            } finally {
                if (!controller.signal.aborted) {
                    timeoutId = window.setTimeout(loadMessages, 5000);
                }
            }
        };

        setHistory(null);
        loadMessages();

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [token, companyId, selectedConversationId, messagePage, refresh]);

    const selected = conversations.find((item) => item.id === selectedConversationId);
    const currentHistory = history?.conversationId === selectedConversationId && history?.page === messagePage ? history : null;
    const selectConversation = (id) => {
        selection.current = id;
        setSelectedConversationId(id);
        setMessagePage(1);
        setDraft("");
        setActionError("");
    };
    const sendMessage = async (event) => {
        event.preventDefault();
        if (!selected || !draft.trim() || sending) return;
        const id = selected.id;
        setSending(true);
        setActionError("");
        try {
            await inboxService.sendMessage(id, draft.trim(), { token, companyId });
            if (selection.current === id) {
                setDraft("");
                const data = await inboxService.listMessages(id, { token, companyId });
                if (selection.current === id) {
                    setMessagePage(Math.max(1, Math.ceil(data.total / data.per_page)));
                    setRefresh((value) => value + 1);
                }
            }
        } catch (error) {
            if (selection.current === id) setActionError(displayError(error));
        } finally {
            setSending(false);
        }
    };
    const takeControl = async () => {
        const id = selected.id;
        setSending(true);
        setActionError("");
        try {
            const data = await inboxService.updateControl(id, "human", null, { token, companyId });
            setConversations((items) => items.map((item) => item.id === id ? data.conversation : item));
        } catch (error) {
            if (selection.current === id) setActionError(displayError(error));
        } finally {
            setSending(false);
        }
    };

    return (
        <main className="inbox-page" data-bs-theme="light">
            <header className="inbox-heading">
                <p className="inbox-eyebrow">CLIENTFLOW · ESPACIO DE TRABAJO</p>
                <h1>Conversaciones</h1>
                <p>Una sola bandeja para todos tus canales.</p>
            </header>
            {(error || conversationsError) && <p className="inbox-error" role="alert">{error || conversationsError}</p>}
            <div className="inbox-workspace">
                <aside className="inbox-conversations" aria-label="Conversaciones">
                    <div className="inbox-list-heading"><strong>Bandeja de entrada</strong><span>{conversationTotal}</span></div>
                    <div className="inbox-list">
                        {!companyId || loadingConversations ? <p role="status" className="inbox-note">Cargando conversaciones…</p> : conversations.length === 0 ? (
                            <div className="inbox-empty-list"><span className="inbox-avatar">✉</span><strong>Todavía no hay conversaciones</strong><p>Tus conversaciones aparecerán aquí cuando se reciban.</p></div>
                        ) : conversations.map((item) => (
                            <button type="button" key={item.id} className={`inbox-conversation ${selectedConversationId === item.id ? "is-selected" : ""}`} aria-pressed={selectedConversationId === item.id} onClick={() => selectConversation(item.id)}>
                                <span className="inbox-avatar">{(item.subject || "C").slice(0, 1).toUpperCase()}</span>
                                <span className="inbox-conversation-text"><strong>{item.subject || "Conversación sin título"}</strong><small>{displayLabel(item.channel)}</small><small>{displayLabel(item.status)} · {displayLabel(item.control_mode)}</small></span>
                            </button>
                        ))}
                    </div>
                    <nav className="inbox-pagination" aria-label="Páginas de conversaciones">
                        <button type="button" aria-label="Conversaciones anteriores" disabled={loadingConversations || conversationPage === 1} onClick={() => { selectConversation(null); setConversationPage((page) => page - 1); }}>‹</button>
                        <span>Página {conversationPage}</span>
                        <button type="button" aria-label="Conversaciones siguientes" disabled={loadingConversations || Boolean(conversationsError) || conversationPage * conversationPerPage >= conversationTotal} onClick={() => { selectConversation(null); setConversationPage((page) => page + 1); }}>›</button>
                    </nav>
                </aside>
                <section className="inbox-chat" aria-label="Historial de mensajes">
                    <header className="inbox-chat-heading">
                        <span className="inbox-avatar">{selected ? (selected.subject || "C").slice(0, 1).toUpperCase() : "✉"}</span>
                        <div><strong>{selected?.subject || (selected ? "Conversación sin título" : "Tus conversaciones")}</strong><small>{selected ? `${displayLabel(selected.channel)} · ${displayLabel(selected.status)}` : "Selecciona una conversación para empezar"}</small></div>
                    </header>
                    <div className="inbox-messages">
                        {!selected ? <div className="inbox-empty-chat"><span className="inbox-empty-icon">✉</span><h2>Un espacio para cada conversación</h2><p>Selecciona una conversación a la izquierda para ver su historial.</p></div> : !currentHistory ? <p role="status" className="inbox-note">Cargando mensajes…</p> : currentHistory.error ? <p role="alert" className="inbox-error">{currentHistory.error}</p> : currentHistory.messages.length === 0 ? <p className="inbox-note">Todavía no hay mensajes.</p> : currentHistory.messages.map((message) => (
                            <article key={message.id} className={`inbox-message ${message.direction === "outbound" ? "is-outbound" : ""}`}>
                                <p>{message.content}</p>
                                <small>{message.created_at ? new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : ""}{message.sent_by_ai ? " · IA" : ""}{message.direction === "outbound" ? ` · ${displayLabel(message.delivery_status || "stored")}` : ""}</small>
                            </article>
                        ))}
                    </div>
                    {selected && currentHistory && !currentHistory.error && currentHistory.total > currentHistory.perPage && <nav className="inbox-pagination" aria-label="Páginas de mensajes">
                        <button type="button" disabled={messagePage === 1} onClick={() => setMessagePage((page) => page - 1)}>Anterior</button><span>Página {messagePage}</span><button type="button" disabled={messagePage * currentHistory.perPage >= currentHistory.total} onClick={() => setMessagePage((page) => page + 1)}>Siguiente</button>
                    </nav>}
                    {actionError && <p role="alert" className="inbox-error">{actionError}</p>}
                    {selected?.control_mode === "ai" && <div className="inbox-control"><span>La IA está atendiendo esta conversación.</span><button type="button" disabled={sending} onClick={takeControl}>Asumir el control</button></div>}
                    {selected && <AIReplyPanel key={`${companyId}-${selected.id}`} conversationId={selected.id} token={token} companyId={companyId} onChanged={() => { setRefresh(v => v + 1); inboxService.listConversations({token, companyId}, conversationPage).then(data => setConversations(data.conversations)).catch(() => setActionError("No se pudo actualizar la lista.")); }} />}
                    <form className="inbox-composer" onSubmit={sendMessage}>
                        <label className="visually-hidden" htmlFor="inbox-message">Mensaje</label>
                        <textarea id="inbox-message" rows="2" maxLength={10000} placeholder="Escribe un mensaje…" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selected || sending || selected.control_mode === "ai"} />
                        <button type="submit" aria-label="Enviar mensaje" disabled={!selected || !draft.trim() || sending || selected.control_mode === "ai"}>{sending ? "…" : "➤"}</button>
                    </form>
                </section>
                <aside className="inbox-details" aria-label="Detalles de la conversación">
                    <span className="inbox-avatar inbox-avatar-large">{selected ? (selected.subject || "C").slice(0, 1).toUpperCase() : "—"}</span>
                    <h2>{selected?.subject || "Detalles de la conversación"}</h2>
                    <p>{selected ? displayLabel(selected.status) : "Selecciona una conversación para ver sus detalles."}</p>
                    {selected && <dl><dt>Canal</dt><dd>{displayLabel(selected.channel)}</dd><dt>Control</dt><dd>{displayLabel(selected.control_mode)}</dd><dt>Responsable</dt><dd>{selected.assigned_membership_id ?? "Sin asignar"}</dd><dt>Último mensaje</dt><dd>{selected.last_message_at ? new Date(selected.last_message_at).toLocaleString("es-ES") : "Todavía no hay mensajes"}</dd></dl>}
                </aside>
            </div>
        </main>
    );
};
