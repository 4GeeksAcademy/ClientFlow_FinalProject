import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { sharedAppointments } from "../../data/sharedAppointments";
import { initialClients } from "../../data/clientsMockData";
import { initialJobs } from "../../data/jobsMockData";
import { agendaTranslations } from "../i18n/agenda";
import { dateKey, parseDate, monthCells, dayAppointments } from "../utils/calendar.mjs";

const levels = ["year", "month", "day"];
const colors = { measurement: "#635bff", sales: "#146c43", review: "#a64b00", installation: "#006080" };
const typeKeys = { "Medición": "measurement", "Comercial": "sales", "Revisión": "review", "Instalación": "installation" };

export const Agenda = () => {
    const location = useLocation();
    const [language, setLanguage] = useState(() => {
        const saved = localStorage.getItem("language")?.split("-")[0];
        return agendaTranslations[saved] ? saved : "es";
    });
    const t = (key) => agendaTranslations[language][key] || key;
    const locale = { en: "en-GB", es: "es-ES", pt: "pt-PT" }[language];
    const [appointments, setAppointments] = useState(sharedAppointments);
    const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
    const [view, setView] = useState("month");
    const [details, setDetails] = useState(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ title: "", date: "", time: "10:00", type: "measurement", clientId: "", jobId: "", responsible: "" });
    const [error, setError] = useState("");
    const [missing, setMissing] = useState(false);
    const dialog = useRef(null);
    const date = parseDate(selectedDate);
    const selected = dayAppointments(appointments, selectedDate);
    const formatDate = (value, options) => new Intl.DateTimeFormat(locale, options).format(value);
    const typeOf = (item) => typeKeys[item.type] || item.type;

    useEffect(() => {
        const id = new URLSearchParams(location.search).get("appointmentId");
        if (!id) return;
        const appointment = sharedAppointments.find(item => item.id === id);
        setMissing(!appointment);
        if (appointment) {
            setSelectedDate(appointment.date);
            setView("day");
            setDetails(appointment);
        }
    }, [location.search]);

    useEffect(() => {
        if ((details || creating) && !dialog.current.open) dialog.current.showModal();
        if (!details && !creating && dialog.current.open) dialog.current.close();
    }, [details, creating]);

    const close = () => { setDetails(null); setCreating(false); setError(""); };
    const move = (step) => {
        const next = new Date(date);
        if (view === "year") next.setFullYear(next.getFullYear() + step, 0, 1);
        else if (view === "month") next.setMonth(next.getMonth() + step, 1);
        else next.setDate(next.getDate() + step);
        setSelectedDate(dateKey(next));
    };
    const changeLevel = (step) => setView(levels[Math.max(0, Math.min(2, levels.indexOf(view) + step))]);
    const openDay = (value) => { setSelectedDate(dateKey(value)); setView("day"); };
    const newAppointment = () => {
        setForm({ title: "", date: selectedDate, time: "10:00", type: "measurement", clientId: "", jobId: "", responsible: "" });
        setCreating(true);
    };
    const save = (event) => {
        event.preventDefault();
        const client = initialClients.find(item => item.id === form.clientId);
        const job = initialJobs.find(item => item.id === form.jobId && item.client.email === client?.email);
        if (!client || !job || !form.title.trim() || !form.responsible.trim()) { setError(t("invalid")); return; }
        const appointment = { ...form, title: form.title.trim(), responsible: form.responsible.trim(),
            id: `app-${crypto.randomUUID()}`, clientName: client.name, relatedJob: job.title, status: "confirmed" };
        setAppointments(items => [...items, appointment]);
        setSelectedDate(form.date);
        setView("day");
        close();
    };
    const renderMonth = (month, compact = false) => (
        <div className="agenda-grid">
            {Array.from({ length: 7 }, (_, index) => <span className="small text-center text-body-secondary" key={`w${index}`}>
                {formatDate(new Date(2026, 0, 5 + index), { weekday: "short" })}
            </span>)}
            {monthCells(date.getFullYear(), month).map((value, index) => {
                if (!value) return <span key={`blank${index}`} />;
                const key = dateKey(value);
                const events = dayAppointments(appointments, key);
                return <button key={key} type="button" className={`agenda-day ${key === selectedDate ? "selected" : ""}`}
                    aria-label={`${formatDate(value, { dateStyle: "full" })} (${events.length})`}
                    aria-current={key === dateKey(new Date()) ? "date" : undefined} onClick={() => openDay(value)}>
                    <span>{value.getDate()}</span>
                    <span className="d-flex flex-wrap gap-1 justify-content-center" aria-hidden="true">
                        {events.map(item => <span key={item.id} className="agenda-dot" style={{ background: colors[typeOf(item)] || "#635bff" }} />)}
                    </span>
                    {!compact && events.map(item => <span className="d-none d-md-block small text-truncate" key={item.id}>{item.time} {item.title}</span>)}
                </button>;
            })}
        </div>
    );
    const contact = details && initialClients.find(item => item.id === details.clientId);
    const client = initialClients.find(item => item.id === form.clientId);

    return <section className="agenda-page">
        <header className="d-flex flex-wrap justify-content-between gap-3 mb-3">
            <div><h1 className="h3">{t("title")}</h1><p className="text-body-secondary">{t("subtitle")}</p></div>
            <div className="d-flex align-items-center gap-2">
                <label htmlFor="agenda-language">{t("language")}</label>
                <select id="agenda-language" className="form-select w-auto" value={language} onChange={event => {
                    setLanguage(event.target.value); localStorage.setItem("language", event.target.value);
                }}><option value="en">English</option><option value="es">Español</option><option value="pt">Português</option></select>
                <button className="btn btn-primary" onClick={newAppointment}>{t("new")}</button>
            </div>
        </header>
        <p className="small text-body-secondary">{t("demo")}</p>
        {missing && <p role="alert" className="alert alert-warning">{t("missing")}</p>}
        <nav aria-label={t("title")} className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button className="btn btn-secondary" aria-label={t("previous")} onClick={() => move(-1)}>‹</button>
            <button className="btn btn-secondary" onClick={() => setSelectedDate(dateKey(new Date()))}>{t("today")}</button>
            <button className="btn btn-secondary" aria-label={t("next")} onClick={() => move(1)}>›</button>
            <h2 className="h5 m-0 flex-grow-1">{formatDate(date, view === "year" ? { year: "numeric" } : view === "month" ? { month: "long", year: "numeric" } : { dateStyle: "full" })}</h2>
            <button className="btn btn-secondary" disabled={view === "year"} aria-label={t("zoomOut")} onClick={() => changeLevel(-1)}>−</button>
            <span aria-live="polite">{t(view)}</span>
            <button className="btn btn-secondary" disabled={view === "day"} aria-label={t("zoomIn")} onClick={() => changeLevel(1)}>+</button>
        </nav>
        {view === "year" && <div className="row g-3">{Array.from({ length: 12 }, (_, month) => <div className="col-12 col-md-6 col-xl-4" key={month}>
            <article className="card p-3 h-100"><h3 className="h6">{formatDate(new Date(date.getFullYear(), month, 1), { month: "long" })}</h3>{renderMonth(month, true)}</article>
        </div>)}</div>}
        {view === "month" && <div className="card p-3">{renderMonth(date.getMonth())}</div>}
        {view === "day" && <div className="vstack gap-3">
            {!selected.length && <p role="status" className="alert alert-info">{t("empty")}</p>}
            {selected.map(item => <article className="card p-3" key={item.id} style={{ borderInlineStart: `5px solid ${colors[typeOf(item)] || "#635bff"}` }}>
                <h3 className="h5"><button className="btn btn-link text-start p-0" onClick={() => setDetails(item)}>{item.time} — {item.title}</button></h3>
                <p className="mb-1">{t("type")}: {t(typeOf(item))} · {t("status")}: {t(item.status)}</p>
                <p className="mb-1">{t("client")}: {item.clientName} · {t("owner")}: {item.responsible}</p>
                <p className="mb-0">{t("job")}: {item.relatedJob}</p>
            </article>)}
        </div>}
        <dialog ref={dialog} className="agenda-dialog rounded-3" aria-labelledby="agenda-dialog-title" onCancel={close} onClose={close}>
            <div className="d-flex justify-content-between gap-3 mb-3"><h2 className="h5" id="agenda-dialog-title">{t(creating ? "new" : "details")}</h2>
                <button className="btn btn-secondary btn-sm" onClick={close}>{t("close")}</button></div>
            {details && <>
                <h3 className="h5">{details.title}</h3>
                <dl>{[["date", details.date], ["time", details.time], ["type", t(typeOf(details))], ["status", t(details.status)],
                    ["client", details.clientName], ["owner", details.responsible], ["job", details.relatedJob]].map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl>
                <div className="d-flex flex-wrap gap-2">
                    {contact?.email ? <a className="btn btn-primary" href={`mailto:${contact.email}`}>{t("contact")}</a> : <span>{t("contact")}: {t("unavailable")}</span>}
                    {initialJobs.some(job => job.id === details.jobId) && <Link className="btn btn-secondary" to={`/jobs/${details.jobId}`}>{t("openJob")}</Link>}
                    <button className="btn btn-outline-danger" onClick={() => {
                        if (window.confirm(t("confirmDelete"))) { setAppointments(items => items.filter(item => item.id !== details.id)); close(); }
                    }}>{t("remove")}</button>
                </div>
            </>}
            {creating && <form onSubmit={save} className="vstack gap-3">
                {error && <p role="alert">{error}</p>}
                {[['title', 'name', 'text'], ['date', 'date', 'date'], ['time', 'time', 'time'], ['responsible', 'owner', 'text']].map(([key, label, type]) =>
                    <label key={key}>{t(label)}<input className="form-control" type={type} required value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}
                <label>{t("type")}<select className="form-select" value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
                    {Object.keys(colors).map(key => <option key={key} value={key}>{t(key)}</option>)}
                </select></label>
                <label>{t("client")}<select className="form-select" required value={form.clientId} onChange={event => setForm({ ...form, clientId: event.target.value, jobId: "" })}>
                    <option value="">{t("select")}</option>{initialClients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></label>
                <label>{t("job")}<select className="form-select" required value={form.jobId} onChange={event => setForm({ ...form, jobId: event.target.value })}>
                    <option value="">{t("select")}</option>{initialJobs.filter(item => item.client.email === client?.email).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select></label>
                <button className="btn btn-primary" type="submit">{t("save")}</button>
            </form>}
        </dialog>
        <style>{`
            .agenda-page { color: var(--bs-body-color); }
            .agenda-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
            .agenda-day { min-width: 0; min-height: 44px; border: 1px solid var(--bs-border-color); border-radius: 6px; background: var(--bs-body-bg); color: var(--bs-body-color); padding: 5px; overflow: hidden; }
            .agenda-day.selected { outline: 2px solid #635bff; outline-offset: -2px; }
            .agenda-day:focus-visible { outline: 3px solid #0d6efd; }
            .agenda-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
            .agenda-dialog { width: min(94vw, 540px); max-height: 90vh; overflow: auto; padding: 24px; border: 1px solid var(--bs-border-color); background: var(--bs-body-bg); color: var(--bs-body-color); }
            .agenda-dialog::backdrop { background: rgba(0,0,0,.55); }
        `}</style>
    </section>;
};
export default Agenda;
