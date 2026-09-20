import { useEffect, useRef, useState } from "react";
import { memberService } from "../services/memberService";
import "../styles/members.css";

const roles = { owner: "Propietario", admin: "Administrador", manager: "Responsable", agent: "Agente", technician: "Técnico" };

export const Members = () => {
    const [members, setMembers] = useState([]);
    const [company, setCompany] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState("");
    const dialog = useRef(null);
    const token = localStorage.getItem("access_token");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        const timer = window.setTimeout(async () => {
            try {
                const base = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
                const response = await fetch(`${base}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
                });
                if (!response.ok) throw new Error("No se pudo verificar tu cuenta. Vuelve a iniciar sesión.");
                const account = await response.json();
                const current = account.companies?.[0];
                if (!current || !["owner", "admin"].includes(current.role)) {
                    throw new Error("No tienes permisos para gestionar este equipo.");
                }
                const data = await memberService.list({ token, companyId: current.id, signal: controller.signal }, page, search, status);
                if (controller.signal.aborted) return;
                setCompany(current);
                setMembers(data.members);
                setTotal(data.total);
                if (page > 1 && data.members.length === 0) setPage(1);
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 200);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [token, page, search, status, revision]);

    const openForm = (member = null) => {
        setEditing(member);
        setFormError("");
        dialog.current.showModal();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (busy || !company) return;
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setFormError("");
        try {
            const options = { token, companyId: company.id };
            if (editing) {
                await memberService.update(options, editing.id, {
                    role: form.get("role"), is_active: form.get("active") === "true",
                });
                setNotice("Miembro actualizado.");
            } else {
                await memberService.invite(options, form.get("email").trim(), form.get("role"));
                setNotice("Invitación creada. En modo local, el enlace se guarda en la bandeja de pruebas; no se envía un correo real.");
            }
            dialog.current.close();
            setRevision((value) => value + 1);
        } catch (failure) {
            setFormError(failure.message);
        } finally { setBusy(false); }
    };

    return (
        <section className="team-page">
            <header className="team-heading">
                <div>
                    <p className="team-eyebrow">CLIENTFLOW{company ? ` · ${company.name}` : ""}</p>
                    <h1>Usuarios</h1>
                    <p>Equipo, funciones y permisos de acceso.</p>
                </div>
                <button className="team-primary" disabled={loading || !!error} onClick={() => openForm()}>+ Crear nuevo</button>
            </header>
            {notice && <p className="team-notice" role="status">{notice}</p>}
            <div className="team-filters">
                <input aria-label="Buscar en usuarios" placeholder="Buscar en usuarios..." value={search} maxLength={100}
                    onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
                <select aria-label="Filtrar por estado" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                    <option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
                </select>
            </div>
            <div className="team-card" aria-busy={loading}>
                {loading ? <p className="team-empty" role="status">Cargando equipo...</p> : error ? (
                    <div className="team-empty" role="alert"><p>{error}</p><button onClick={() => setRevision((value) => value + 1)}>Reintentar</button></div>
                ) : <>
                    <div className="team-table-scroll"><table className="team-table">
                        <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
                        <tbody>{members.map((member) => {
                            const canEdit = member.id !== company.membership_id && member.role !== "owner" && (company.role === "owner" || member.role !== "admin");
                            return <tr key={member.id}>
                                <td><div className="team-person"><span className="team-avatar">{member.first_name?.[0]?.toUpperCase() || "U"}</span><strong>{member.first_name} {member.last_name}</strong></div></td>
                                <td>{member.email}</td><td>{roles[member.role]}</td>
                                <td><span className={`team-badge ${member.is_active ? "active" : "inactive"}`}>{member.is_active ? "Activo" : "Inactivo"}</span></td>
                                <td>{canEdit && <button className="team-more" aria-label={`Editar a ${member.first_name} ${member.last_name}`} onClick={() => openForm(member)}>•••</button>}</td>
                            </tr>;
                        })}</tbody>
                    </table></div>
                    {members.length === 0 && <p className="team-empty">No hay usuarios que coincidan.</p>}
                    <footer className="team-pagination"><span>{total} resultados</span><div>
                        <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior">‹</button>
                        <span>Página {page}</span><button disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente">›</button>
                    </div></footer>
                </>}
            </div>
            <dialog ref={dialog} className="team-dialog" aria-labelledby="member-form-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
                <form key={editing?.id || "invite"} onSubmit={submit}>
                    <h2 id="member-form-title">{editing ? "Editar miembro" : "Invitar miembro"}</h2>
                    <p>{editing ? `${editing.first_name} ${editing.last_name}` : "La invitación caduca en 48 horas."}</p>
                    {!editing && <label>Correo electrónico<input autoFocus name="email" type="email" required maxLength={255} disabled={busy} /></label>}
                    <label>Rol<select name="role" defaultValue={editing?.role || "agent"} disabled={busy}>
                        {Object.entries(roles).filter(([role]) => role !== "owner" && (role !== "admin" || company?.role === "owner")).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                    </select></label>
                    {editing && <label>Estado<select name="active" defaultValue={String(editing.is_active)} disabled={busy}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>}
                    {formError && <p role="alert" className="text-danger">{formError}</p>}
                    <div className="team-dialog-actions"><button type="button" disabled={busy} onClick={() => dialog.current.close()}>Cancelar</button><button className="team-primary" disabled={busy}>{busy ? "Guardando..." : editing ? "Guardar cambios" : "Crear invitación"}</button></div>
                </form>
            </dialog>
        </section>
    );
};
