import { useEffect, useRef, useState } from "react";
import { memberService } from "../services/memberService";
import "../styles/members.css";
import { useLanguage } from "../context/LanguageContext";
import { translateLiteral } from "../i18n/literalTranslations.mjs";
import { readApiJson } from "../services/response.mjs";

export const Members = () => {
    const { locale, ui } = useLanguage();
    const roles = { owner: ui.owner, admin: ui.administrator, manager: ui.manager, agent: ui.agent, technician: ui.technician };
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
    const [invitationLink, setInvitationLink] = useState("");
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
                const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
                const response = await fetch(`${base}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
                });
                const account = await readApiJson(response, ui.accountLoadError);
                const current = account.companies?.[0];
                if (!current || !["owner", "admin"].includes(current.role)) {
                    throw new Error(ui.teamPermissionError);
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
    }, [token, page, search, status, revision, ui.accountLoadError, ui.teamPermissionError]);

    const openForm = (member = null) => {
        setEditing(member);
        setFormError("");
        if (!member) setInvitationLink("");
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
                setNotice(ui.memberUpdated);
            } else {
                const invitation = await memberService.invite(options, form.get("email").trim(), form.get("role"));
                setInvitationLink(invitation.invitation_url || "");
                setNotice(invitation.delivery === "manual"
                    ? translateLiteral("Invitation created. Copy and share the secure link.", locale)
                    : ui.invitationCreated);
            }
            dialog.current.close();
            setRevision((value) => value + 1);
        } catch (failure) {
            setFormError(translateLiteral(failure.message, locale));
        } finally { setBusy(false); }
    };

    return (
        <section className="team-page">
            <header className="team-heading">
                <div>
                    <p className="team-eyebrow">CLIENTFLOW{company ? ` · ${company.name}` : ""}</p>
                    <h1>{ui.teamTitle}</h1>
                    <p>{ui.teamSubtitle}</p>
                </div>
                <button className="team-primary" disabled={loading || !!error} onClick={() => openForm()}>+ {ui.createNew}</button>
            </header>
            {notice && <p className="team-notice" role="status">{notice}</p>}
            {invitationLink && <div className="team-notice" role="status">
                <strong className="d-block mb-2">{translateLiteral("Secure invitation link", locale)}</strong>
                <div className="d-flex flex-column flex-md-row gap-2">
                    <input className="form-control" readOnly value={invitationLink} aria-label={translateLiteral("Secure invitation link", locale)} />
                    <button type="button" className="team-primary" onClick={() => navigator.clipboard.writeText(invitationLink)}>{translateLiteral("Copy link", locale)}</button>
                </div>
            </div>}
            <div className="team-filters">
                <input aria-label={ui.searchUsers} placeholder={ui.searchUsers} value={search} maxLength={100}
                    onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
                <select aria-label={ui.filterStatus} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                    <option value="all">{ui.allStatuses}</option><option value="active">{ui.active}</option><option value="inactive">{ui.inactive}</option>
                </select>
            </div>
            <div className="team-card" aria-busy={loading}>
                {loading ? <p className="team-empty" role="status">{ui.teamLoading}</p> : error ? (
                    <div className="team-empty" role="alert"><p>{error}</p><button onClick={() => setRevision((value) => value + 1)}>{ui.retry}</button></div>
                ) : <>
                    <div className="team-table-scroll"><table className="team-table">
                        <thead><tr><th>{ui.user}</th><th>{ui.email}</th><th>{ui.role}</th><th>{ui.status}</th><th><span className="visually-hidden">{ui.actions}</span></th></tr></thead>
                        <tbody>{members.map((member) => {
                            const canEdit = member.id !== company.membership_id && member.role !== "owner" && (company.role === "owner" || member.role !== "admin");
                            return <tr key={member.id}>
                                <td><div className="team-person"><span className="team-avatar">{member.first_name?.[0]?.toUpperCase() || "U"}</span><strong>{member.first_name} {member.last_name}</strong></div></td>
                                <td>{member.email}</td><td>{roles[member.role]}</td>
                                <td><span className={`team-badge ${member.is_active ? "active" : "inactive"}`}>{member.is_active ? ui.active : ui.inactive}</span></td>
                                <td>{canEdit && <button className="team-more" aria-label={`${ui.edit} ${member.first_name} ${member.last_name}`} onClick={() => openForm(member)}>•••</button>}</td>
                            </tr>;
                        })}</tbody>
                    </table></div>
                    {members.length === 0 && <p className="team-empty">{ui.noMatchingUsers}</p>}
                    <footer className="team-pagination"><span>{ui.results.replace("{count}", total)}</span><div>
                        <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label={`${ui.page} ${ui.previous}`}>‹</button>
                        <span>{ui.page} {page}</span><button disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} aria-label={`${ui.page} ${ui.next}`}>›</button>
                    </div></footer>
                </>}
            </div>
            <dialog ref={dialog} className="team-dialog" aria-labelledby="member-form-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
                <form key={editing?.id || "invite"} onSubmit={submit}>
                    <h2 id="member-form-title">{editing ? ui.editMember : ui.inviteMember}</h2>
                    <p>{editing ? `${editing.first_name} ${editing.last_name}` : ui.invitationExpires}</p>
                    {!editing && <label>{ui.email}<input autoFocus name="email" type="email" required maxLength={255} disabled={busy} /></label>}
                    <label>{ui.role}<select name="role" defaultValue={editing?.role || "agent"} disabled={busy}>
                        {Object.entries(roles).filter(([role]) => role !== "owner" && (role !== "admin" || company?.role === "owner")).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                    </select></label>
                    {editing && <label>{ui.status}<select name="active" defaultValue={String(editing.is_active)} disabled={busy}><option value="true">{ui.active}</option><option value="false">{ui.inactive}</option></select></label>}
                    {formError && <p role="alert" className="text-danger">{formError}</p>}
                    <div className="team-dialog-actions"><button type="button" disabled={busy} onClick={() => dialog.current.close()}>{ui.cancel}</button><button className="team-primary" disabled={busy}>{busy ? ui.saving : editing ? ui.saveChanges : ui.sendInvitation}</button></div>
                </form>
            </dialog>
        </section>
    );
};
