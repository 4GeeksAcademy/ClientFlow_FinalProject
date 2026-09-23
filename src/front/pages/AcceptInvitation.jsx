import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/members.css";

export const AcceptInvitation = () => {
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
        const base = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
        const post = async (path, body, token) => {
            const response = await fetch(`${base}/api${path}`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "No se pudo aceptar la invitación.");
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
                if (fields.password !== fields.password_confirmation) throw new Error("Las contraseñas no coinciden.");
                await post("/members/invitations/register", { ...fields, token: invitationToken });
            }
            window.history.replaceState(null, "", window.location.pathname);
            setDone(true);
        } catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
    };
    return <main className="invite-page"><section className="invite-panel">
        <p className="text-muted">CLIENTFLOW</p><h1>Únete a tu equipo</h1>
        {done ? <><p role="status">Invitación aceptada. Ya puedes iniciar sesión.</p><Link to="/login">Iniciar sesión</Link></> : !invitationToken ? <p role="alert">El enlace no es válido. Solicita una invitación a tu administrador.</p> : <>
            <p>{existing ? "Accede con la cuenta del correo invitado." : "Crea tu cuenta para aceptar la invitación."}</p>
            <form key={String(existing)} onSubmit={submit}>
                {existing ? <label>Correo electrónico<input name="email" type="email" autoComplete="username" required disabled={busy} /></label> : <>
                    <label>Nombre<input name="first_name" autoComplete="given-name" maxLength={100} required disabled={busy} /></label>
                    <label>Apellidos<input name="last_name" autoComplete="family-name" maxLength={100} required disabled={busy} /></label>
                </>}
                <label>Contraseña<input name="password" type="password" autoComplete={existing ? "current-password" : "new-password"} minLength={12} maxLength={128} required disabled={busy} /></label>
                {!existing && <label>Repite la contraseña<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} /></label>}
                {error && <p className="text-danger" role="alert">{error}</p>}
                <button className="team-primary" disabled={busy}>{busy ? "Procesando..." : "Aceptar invitación"}</button>
            </form>
            <button className="invite-toggle" disabled={busy} onClick={() => { setExisting(!existing); setError(""); }}>{existing ? "Necesito crear una cuenta" : "Ya tengo una cuenta"}</button>
        </>}
    </section></main>;
};
