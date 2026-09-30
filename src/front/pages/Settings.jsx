import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../context/LanguageContext";
import { settingsService } from "../services/settingsService";
import "./Settings.css";

const copy = {
    en: {
        title: "Settings", subtitle: "Manage your company, workspace and connected services.",
        company: "Company", appearance: "Appearance", users: "Users and permissions",
        integrations: "Integrations", ai: "AI and knowledge", security: "Security",
        companyIntro: "The information shown to your team and customers.", name: "Company name",
        email: "Company email", phone: "Phone", timezone: "Timezone", colour: "Brand colour",
        saveCompany: "Save company", appearanceIntro: "Choose the default experience for this workspace.",
        theme: "Theme", system: "Use system", light: "Light", dark: "Dark", language: "Language",
        density: "Interface density", comfortable: "Comfortable", compact: "Compact",
        savePreferences: "Save preferences", usersIntro: "Manage who can access this company and what they can do.",
        activeMembers: "active members", openTeam: "Manage team", integrationsIntro: "Configure channels without exposing private credentials in the browser.",
        enabled: "Enabled", saveIntegration: "Save integration", emailChannel: "Email",
        webChat: "Web chat", whatsapp: "WhatsApp", connected: "Configured", disconnected: "Disconnected",
        smtpHost: "SMTP host", smtpPort: "SMTP port", encryption: "Encryption", sender: "Sender address",
        displayName: "Display name", welcome: "Welcome message", accent: "Accent colour", whatsappNumber: "International number",
        aiIntro: "Keep agents connected only to approved company knowledge.", activeAgents: "Active agents",
        documents: "Documents", ready: "ready", manageAgents: "Manage agents", manageKnowledge: "Manage knowledge",
        serviceReady: "AI service configured", serviceMissing: "AI service needs server configuration",
        securityIntro: "Review account activity and close sessions you no longer use.", activeSessions: "Active sessions",
        lastLogin: "Last login", never: "Not available", resetPassword: "Change password", closeSessions: "Close other sessions",
        readOnly: "Your role can view these settings. An administrator must save workspace changes.",
        loading: "Loading settings...", retry: "Try again", saved: "Changes saved.",
    },
    es: {
        title: "Configuración", subtitle: "Gestiona tu empresa, el espacio de trabajo y los servicios conectados.",
        company: "Empresa", appearance: "Apariencia", users: "Usuarios y permisos",
        integrations: "Integraciones", ai: "IA y conocimiento", security: "Seguridad",
        companyIntro: "La información que verá tu equipo y tus clientes.", name: "Nombre de la empresa",
        email: "Email de la empresa", phone: "Teléfono", timezone: "Zona horaria", colour: "Color de marca",
        saveCompany: "Guardar empresa", appearanceIntro: "Elige la experiencia predeterminada del espacio de trabajo.",
        theme: "Tema", system: "Usar el sistema", light: "Claro", dark: "Oscuro", language: "Idioma",
        density: "Densidad de la interfaz", comfortable: "Cómoda", compact: "Compacta",
        savePreferences: "Guardar preferencias", usersIntro: "Gestiona quién accede a la empresa y qué puede hacer.",
        activeMembers: "miembros activos", openTeam: "Gestionar equipo", integrationsIntro: "Configura canales sin exponer credenciales privadas en el navegador.",
        enabled: "Activada", saveIntegration: "Guardar integración", emailChannel: "Email",
        webChat: "Chat web", whatsapp: "WhatsApp", connected: "Configurada", disconnected: "Desconectada",
        smtpHost: "Servidor SMTP", smtpPort: "Puerto SMTP", encryption: "Cifrado", sender: "Dirección remitente",
        displayName: "Nombre visible", welcome: "Mensaje de bienvenida", accent: "Color de acento", whatsappNumber: "Número internacional",
        aiIntro: "Mantén los agentes conectados solamente al conocimiento autorizado de la empresa.", activeAgents: "Agentes activos",
        documents: "Documentos", ready: "listos", manageAgents: "Gestionar agentes", manageKnowledge: "Gestionar conocimiento",
        serviceReady: "Servicio de IA configurado", serviceMissing: "El servicio de IA necesita configuración en el servidor",
        securityIntro: "Revisa la actividad de la cuenta y cierra sesiones que ya no utilizas.", activeSessions: "Sesiones activas",
        lastLogin: "Último acceso", never: "No disponible", resetPassword: "Cambiar contraseña", closeSessions: "Cerrar otras sesiones",
        readOnly: "Tu rol puede consultar estos ajustes. Un administrador debe guardar los cambios del espacio.",
        loading: "Cargando configuración...", retry: "Reintentar", saved: "Cambios guardados.",
    },
    pt: {
        title: "Configurações", subtitle: "Gerencie sua empresa, o espaço de trabalho e os serviços conectados.",
        company: "Empresa", appearance: "Aparência", users: "Usuários e permissões",
        integrations: "Integrações", ai: "IA e conhecimento", security: "Segurança",
        companyIntro: "As informações exibidas para sua equipe e seus clientes.", name: "Nome da empresa",
        email: "Email da empresa", phone: "Telefone", timezone: "Fuso horário", colour: "Cor da marca",
        saveCompany: "Salvar empresa", appearanceIntro: "Escolha a experiência padrão deste espaço de trabalho.",
        theme: "Tema", system: "Usar o sistema", light: "Claro", dark: "Escuro", language: "Idioma",
        density: "Densidade da interface", comfortable: "Confortável", compact: "Compacta",
        savePreferences: "Salvar preferências", usersIntro: "Gerencie quem acessa esta empresa e o que pode fazer.",
        activeMembers: "membros ativos", openTeam: "Gerenciar equipe", integrationsIntro: "Configure canais sem expor credenciais privadas no navegador.",
        enabled: "Ativada", saveIntegration: "Salvar integração", emailChannel: "Email",
        webChat: "Chat web", whatsapp: "WhatsApp", connected: "Configurada", disconnected: "Desconectada",
        smtpHost: "Servidor SMTP", smtpPort: "Porta SMTP", encryption: "Criptografia", sender: "Endereço remetente",
        displayName: "Nome visível", welcome: "Mensagem de boas-vindas", accent: "Cor de destaque", whatsappNumber: "Número internacional",
        aiIntro: "Mantenha os agentes conectados apenas ao conhecimento autorizado da empresa.", activeAgents: "Agentes ativos",
        documents: "Documentos", ready: "prontos", manageAgents: "Gerenciar agentes", manageKnowledge: "Gerenciar conhecimento",
        serviceReady: "Serviço de IA configurado", serviceMissing: "O serviço de IA precisa de configuração no servidor",
        securityIntro: "Revise a atividade da conta e encerre sessões que não usa mais.", activeSessions: "Sessões ativas",
        lastLogin: "Último acesso", never: "Não disponível", resetPassword: "Alterar senha", closeSessions: "Encerrar outras sessões",
        readOnly: "Sua função pode consultar estas configurações. Um administrador deve salvar alterações do espaço.",
        loading: "Carregando configurações...", retry: "Tentar novamente", saved: "Alterações salvas.",
    },
};

const integrationDefaults = {
    email: { smtp_host: "", smtp_port: 587, security: "starttls", from_address: "" },
    web_chat: { display_name: "ClientFlow", welcome_message: "Hola, ¿en qué podemos ayudarte?", accent_colour: "#635BFF" },
    whatsapp: { display_name: "", phone_number: "" },
};

export const Settings = () => {
    const token = localStorage.getItem("access_token");
    const { theme, setTheme, density, setDensity } = useApp();
    const { locale, setLocale } = useLanguage();
    const text = copy[locale] || copy.en;
    const [tab, setTab] = useState("company");
    const [data, setData] = useState(null);
    const [company, setCompany] = useState({});
    const [preferences, setPreferences] = useState({ theme, language: locale, density });
    const [integrationForms, setIntegrationForms] = useState({});
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");

    const tabs = useMemo(() => [
        ["company", "fa-building", text.company],
        ["appearance", "fa-palette", text.appearance],
        ["users", "fa-user-shield", text.users],
        ["integrations", "fa-plug", text.integrations],
        ["ai", "fa-robot", text.ai],
        ["security", "fa-shield-halved", text.security],
    ], [text]);

    const load = async (signal) => {
        setError("");
        try {
            const result = await settingsService.load(token, signal);
            setData(result);
            setCompany(result.company);
            setPreferences((current) => ({
                ...current,
                theme: result.company.theme || current.theme,
                language: result.company.default_language || current.language,
            }));
            setTheme(result.company.theme || "system");
            setLocale(result.company.default_language || "en");
            const forms = {};
            Object.entries(integrationDefaults).forEach(([provider, defaults]) => {
                const saved = result.integrations[provider];
                forms[provider] = {
                    enabled: saved.status === "configured",
                    settings: { ...defaults, ...(saved.settings || {}) },
                };
            });
            setIntegrationForms(forms);
        } catch (requestError) {
            if (requestError.name !== "AbortError") setError(requestError.message);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, []);

    const options = { token, companyId: data?.companyId };
    const run = async (key, action, successMessage = text.saved) => {
        setBusy(key);
        setNotice(null);
        try {
            const result = await action();
            setNotice({ type: "success", message: result.message || successMessage });
            return result;
        } catch (requestError) {
            setNotice({ type: "error", message: requestError.message });
            return null;
        } finally {
            setBusy("");
        }
    };

    const saveCompany = async (event) => {
        event.preventDefault();
        const result = await run("company", () => settingsService.saveCompany(options, {
            name: company.name,
            email: company.email || null,
            phone: company.phone || null,
            timezone: company.timezone,
            primary_colour: company.primary_colour || null,
        }));
        if (result) window.dispatchEvent(new CustomEvent("clientflow:company-updated"));
    };

    const savePreferences = async (event) => {
        event.preventDefault();
        const result = await run("preferences", () => settingsService.savePreferences(options, {
            theme: preferences.theme,
            language: preferences.language,
        }));
        if (result) {
            setTheme(preferences.theme);
            setLocale(preferences.language);
            setDensity(preferences.density);
        }
    };

    const changeIntegration = (provider, field, value) => {
        setIntegrationForms((current) => ({
            ...current,
            [provider]: field === "enabled"
                ? { ...current[provider], enabled: value }
                : { ...current[provider], settings: { ...current[provider].settings, [field]: value } },
        }));
    };

    const saveIntegration = async (event, provider) => {
        event.preventDefault();
        const result = await run(provider, () => settingsService.saveIntegration(options, provider, integrationForms[provider]));
        if (result) {
            setData((current) => ({
                ...current,
                integrations: { ...current.integrations, [provider]: result.integration },
            }));
        }
    };

    if (!data && !error) return <div className="settings-state" role="status">{text.loading}</div>;
    if (!data) return <div className="settings-state settings-error" role="alert"><p>{error}</p><button onClick={() => load()}>{text.retry}</button></div>;

    const canManage = data.membership.can_manage;
    const disabled = !canManage;
    const statusLabel = (provider) => data.integrations[provider].status === "configured" ? text.connected : text.disconnected;

    return (
        <main className="settings-page">
            <header className="settings-header">
                <div><p>CLIENTFLOW · {text.company.toUpperCase()}</p><h1>{text.title}</h1><span>{text.subtitle}</span></div>
                <div className="settings-company-mark" style={{ background: company.primary_colour || "#635BFF" }}>{company.name?.[0]?.toUpperCase() || "C"}</div>
            </header>

            {notice && <div className={`settings-notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.message}</div>}
            {!canManage && <div className="settings-notice info">{text.readOnly}</div>}

            <div className="settings-layout">
                <nav className="settings-tabs" aria-label={text.title}>
                    {tabs.map(([id, icon, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => { setTab(id); setNotice(null); }}><i className={`fa-solid ${icon}`} />{label}</button>)}
                </nav>

                <section className="settings-panel">
                    {tab === "company" && <form onSubmit={saveCompany}>
                        <PanelTitle title={text.company} description={text.companyIntro} />
                        <div className="settings-grid two">
                            <Field label={text.name}><input value={company.name || ""} maxLength={160} required disabled={disabled} onChange={(event) => setCompany({ ...company, name: event.target.value })} /></Field>
                            <Field label={text.email}><input type="email" value={company.email || ""} maxLength={255} disabled={disabled} onChange={(event) => setCompany({ ...company, email: event.target.value })} /></Field>
                            <Field label={text.phone}><input value={company.phone || ""} maxLength={40} disabled={disabled} onChange={(event) => setCompany({ ...company, phone: event.target.value })} /></Field>
                            <Field label={text.timezone}><input value={company.timezone || ""} maxLength={60} required disabled={disabled} onChange={(event) => setCompany({ ...company, timezone: event.target.value })} /></Field>
                            <Field label={text.colour}><div className="colour-field"><input type="color" value={company.primary_colour || "#635BFF"} disabled={disabled} onChange={(event) => setCompany({ ...company, primary_colour: event.target.value })} /><input value={company.primary_colour || "#635BFF"} pattern="#[0-9A-Fa-f]{6}" disabled={disabled} onChange={(event) => setCompany({ ...company, primary_colour: event.target.value })} /></div></Field>
                        </div>
                        {canManage && <SaveButton busy={busy === "company"}>{text.saveCompany}</SaveButton>}
                    </form>}

                    {tab === "appearance" && <form onSubmit={savePreferences}>
                        <PanelTitle title={text.appearance} description={text.appearanceIntro} />
                        <div className="settings-grid three">
                            <Field label={text.theme}><select value={preferences.theme} disabled={disabled} onChange={(event) => setPreferences({ ...preferences, theme: event.target.value })}><option value="system">{text.system}</option><option value="light">{text.light}</option><option value="dark">{text.dark}</option></select></Field>
                            <Field label={text.language}><select value={preferences.language} disabled={disabled} onChange={(event) => setPreferences({ ...preferences, language: event.target.value })}><option value="es">Español</option><option value="en">English</option><option value="pt">Português</option></select></Field>
                            <Field label={text.density}><select value={preferences.density} disabled={disabled} onChange={(event) => setPreferences({ ...preferences, density: event.target.value })}><option value="comfortable">{text.comfortable}</option><option value="compact">{text.compact}</option></select></Field>
                        </div>
                        {canManage && <SaveButton busy={busy === "preferences"}>{text.savePreferences}</SaveButton>}
                    </form>}

                    {tab === "users" && <div><PanelTitle title={text.users} description={text.usersIntro} /><div className="settings-metric"><i className="fa-solid fa-users" /><strong>{data.overview.members}</strong><span>{text.activeMembers}</span></div><Link className="settings-link-button" to="/team">{text.openTeam}<i className="fa-solid fa-arrow-right" /></Link></div>}

                    {tab === "integrations" && <div><PanelTitle title={text.integrations} description={text.integrationsIntro} /><div className="integration-list">
                        <IntegrationCard title={text.emailChannel} icon="fa-envelope" status={statusLabel("email")} form={integrationForms.email} disabled={disabled} busy={busy === "email"} onChange={(field, value) => changeIntegration("email", field, value)} onSubmit={(event) => saveIntegration(event, "email")} text={text} provider="email" />
                        <IntegrationCard title={text.webChat} icon="fa-comments" status={statusLabel("web_chat")} form={integrationForms.web_chat} disabled={disabled} busy={busy === "web_chat"} onChange={(field, value) => changeIntegration("web_chat", field, value)} onSubmit={(event) => saveIntegration(event, "web_chat")} text={text} provider="web_chat" />
                        <IntegrationCard title={text.whatsapp} icon="fa-brands fa-whatsapp" status={statusLabel("whatsapp")} form={integrationForms.whatsapp} disabled={disabled} busy={busy === "whatsapp"} onChange={(field, value) => changeIntegration("whatsapp", field, value)} onSubmit={(event) => saveIntegration(event, "whatsapp")} text={text} provider="whatsapp" />
                    </div></div>}

                    {tab === "ai" && <div><PanelTitle title={text.ai} description={text.aiIntro} /><div className="settings-metrics"><div className="settings-metric"><i className="fa-solid fa-robot" /><strong>{data.overview.agents}</strong><span>{text.activeAgents}</span></div><div className="settings-metric"><i className="fa-solid fa-book" /><strong>{data.overview.knowledge_documents}</strong><span>{text.documents} · {data.overview.ready_documents} {text.ready}</span></div></div><div className={`ai-service-state ${data.ai_service.configured ? "ready" : "missing"}`}><i className={`fa-solid ${data.ai_service.configured ? "fa-circle-check" : "fa-circle-exclamation"}`} />{data.ai_service.configured ? text.serviceReady : text.serviceMissing}{data.ai_service.model && <span>{data.ai_service.model}</span>}</div><div className="settings-action-row"><Link className="settings-link-button" to="/agent-ai">{text.manageAgents}</Link><Link className="settings-secondary-button" to="/knowledge">{text.manageKnowledge}</Link></div></div>}

                    {tab === "security" && <div><PanelTitle title={text.security} description={text.securityIntro} /><div className="security-list"><div><span>{text.activeSessions}</span><strong>{data.security.active_sessions}</strong></div><div><span>{text.lastLogin}</span><strong>{data.security.last_login_at ? new Date(data.security.last_login_at).toLocaleString(locale) : text.never}</strong></div></div><div className="settings-action-row"><Link className="settings-secondary-button" to="/forgot-password">{text.resetPassword}</Link><button className="settings-danger-button" disabled={busy === "sessions"} onClick={() => run("sessions", () => settingsService.revokeOtherSessions(options))}>{text.closeSessions}</button></div></div>}
                </section>
            </div>
        </main>
    );
};

const PanelTitle = ({ title, description }) => <div className="settings-panel-title"><h2>{title}</h2><p>{description}</p></div>;
const Field = ({ label, children }) => <label className="settings-field"><span>{label}</span>{children}</label>;
const SaveButton = ({ busy, children }) => <button className="settings-primary-button" disabled={busy}>{busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}{children}</button>;

const IntegrationCard = ({ title, icon, status, form, disabled, busy, onChange, onSubmit, text, provider }) => {
    if (!form) return null;
    return <form className="integration-card" onSubmit={onSubmit}><div className="integration-heading"><div><i className={icon.startsWith("fa-brands") ? icon : `fa-solid ${icon}`} /><div><h3>{title}</h3><span>{status}</span></div></div><label className="settings-switch"><input type="checkbox" checked={form.enabled} disabled={disabled} onChange={(event) => onChange("enabled", event.target.checked)} /><span>{text.enabled}</span></label></div>{form.enabled && <div className="settings-grid two integration-fields">{provider === "email" && <><Field label={text.smtpHost}><input required disabled={disabled} value={form.settings.smtp_host} onChange={(event) => onChange("smtp_host", event.target.value)} /></Field><Field label={text.smtpPort}><input required type="number" min="1" max="65535" disabled={disabled} value={form.settings.smtp_port} onChange={(event) => onChange("smtp_port", Number(event.target.value))} /></Field><Field label={text.encryption}><select disabled={disabled} value={form.settings.security} onChange={(event) => onChange("security", event.target.value)}><option value="starttls">STARTTLS</option><option value="tls">TLS</option></select></Field><Field label={text.sender}><input required type="email" disabled={disabled} value={form.settings.from_address} onChange={(event) => onChange("from_address", event.target.value)} /></Field></>}{provider === "web_chat" && <><Field label={text.displayName}><input required disabled={disabled} value={form.settings.display_name} onChange={(event) => onChange("display_name", event.target.value)} /></Field><Field label={text.accent}><input required pattern="#[0-9A-Fa-f]{6}" disabled={disabled} value={form.settings.accent_colour} onChange={(event) => onChange("accent_colour", event.target.value)} /></Field><Field label={text.welcome}><input required disabled={disabled} value={form.settings.welcome_message} onChange={(event) => onChange("welcome_message", event.target.value)} /></Field></>}{provider === "whatsapp" && <><Field label={text.displayName}><input required disabled={disabled} value={form.settings.display_name} onChange={(event) => onChange("display_name", event.target.value)} /></Field><Field label={text.whatsappNumber}><input required placeholder="+34600000000" disabled={disabled} value={form.settings.phone_number} onChange={(event) => onChange("phone_number", event.target.value)} /></Field></>}</div>}{!disabled && <SaveButton busy={busy}>{text.saveIntegration}</SaveButton>}</form>;
};

export default Settings;
