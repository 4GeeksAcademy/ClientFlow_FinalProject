import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../context/LanguageContext";
import { settingsMessages } from "../i18n/settings.mjs";
import { settingsService } from "../services/settingsService";
import "./Settings.css";

const integrationDefaults = {
    email: { smtp_host: "", smtp_port: 587, security: "starttls", from_address: "" },
    web_chat: { display_name: "ClientFlow", welcome_message: "Hola, ¿en qué podemos ayudarte?", accent_colour: "#635BFF" },
    whatsapp: { display_name: "", phone_number: "" },
};

export const Settings = () => {
    const token = localStorage.getItem("access_token");
    const { theme, setTheme, density, setDensity, setBrandColour } = useApp();
    const { locale, setLocale } = useLanguage();
    const text = settingsMessages[locale] || settingsMessages.en;
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
            setBrandColour(result.company.primary_colour || "#635BFF");
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
        if (result) {
            setBrandColour(company.primary_colour || "#635BFF");
            window.dispatchEvent(new CustomEvent("clientflow:company-updated"));
        }
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

    const changeCompanyColour = (value) => {
        setCompany((current) => ({ ...current, primary_colour: value }));
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) setBrandColour(value);
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
                            <Field label={text.colour}><div className="colour-field"><input type="color" value={company.primary_colour || "#635BFF"} disabled={disabled} onChange={(event) => changeCompanyColour(event.target.value)} /><input value={company.primary_colour || "#635BFF"} pattern="#[0-9A-Fa-f]{6}" disabled={disabled} onChange={(event) => changeCompanyColour(event.target.value)} /></div></Field>
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
