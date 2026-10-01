import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/members.css";
import { useLanguage } from "../context/LanguageContext";
import { WorkspacePreferences } from "../components/WorkspacePreferences";

export const AcceptInvitation = () => {
    const { ui } = useLanguage();
    const [invitationToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
    const [existing, setExisting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        setBusy(true); setError("");
        const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
        const post = async (path, body, token) => {
            const response = await fetch(`${base}/api${path}`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || ui.invitationAcceptError);
            return data;
        };
        try {
            if (existing) {
                const session = await post("/login", { email: fields.email, password: fields.password });
                try {
                    await post("/members/invitations/accept", { token: invitationToken }, session.token);
                } finally {
                    await post("/logout", {}, session.token).catch(() => {});
                }
            } else {
                if (fields.password !== fields.password_confirmation) throw new Error(ui.passwordMismatch);
                await post("/members/invitations/register", { ...fields, token: invitationToken });
            }
            window.history.replaceState(null, "", window.location.pathname);
            setDone(true);
        } catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
    };
    return <main className="invite-page"><div className="position-fixed top-0 end-0 p-3"><WorkspacePreferences /></div><section className="invite-panel">
        <p className="text-muted">CLIENTFLOW</p><h1>{ui.invitationTitle}</h1>
        {done ? <><p role="status">{ui.invitationAccepted}</p><Link to="/login">{ui.signIn}</Link></> : !invitationToken ? <p role="alert">{ui.invitationInvalid}</p> : <>
            <p>{existing ? ui.invitationExisting : ui.invitationNew}</p>
            <form key={String(existing)} onSubmit={submit}>
                {existing ? <label>{ui.email}<input name="email" type="email" autoComplete="username" required disabled={busy} /></label> : <>
                    <label>{ui.firstName}<input name="first_name" autoComplete="given-name" maxLength={100} required disabled={busy} /></label>
                    <label>{ui.lastName}<input name="last_name" autoComplete="family-name" maxLength={100} required disabled={busy} /></label>
                </>}
                <label>{ui.password}<input name="password" type="password" autoComplete={existing ? "current-password" : "new-password"} minLength={12} maxLength={128} required disabled={busy} /></label>
                {!existing && <label>{ui.repeatPassword}<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} /></label>}
                {error && <p className="text-danger" role="alert">{error}</p>}
                <button className="team-primary" disabled={busy}>{busy ? ui.processing : ui.acceptInvitation}</button>
            </form>
            <button className="invite-toggle" disabled={busy} onClick={() => { setExisting(!existing); setError(""); }}>{existing ? ui.needAccount : ui.existingAccount}</button>
        </>}
    </section></main>;
};
