import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { clientService } from "../services/clientService";
import { useLanguage } from "../context/LanguageContext";
import { translateLiteral } from "../i18n/literalTranslations.mjs";
import { readApiJson } from "../services/response.mjs";

const defaultActionForm = () => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return { title: "", description: "", dueAt: localDate.toISOString().slice(0, 16) };
};


export const ClientDetail = () => {
    const { locale, ui } = useLanguage();
    const { id } = useParams();

    const [client, setClient] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [nextActions, setNextActions] = useState([]);
    const [relatedJobs, setRelatedJobs] = useState([]);
    const [clientAppointments, setClientAppointments] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [requestOptions, setRequestOptions] = useState(null);
    const [currentResponsibleName, setCurrentResponsibleName] = useState("");
    const [showActionForm, setShowActionForm] = useState(false);
    const [actionForm, setActionForm] = useState(defaultActionForm);
    const [savingAction, setSavingAction] = useState(false);
    const [actionError, setActionError] = useState("");

    useEffect(() => {
        const loadClient = async () => {
            const token = localStorage.getItem("access_token");

            try {
                setLoading(true);
                setError("");

                const response = await fetch(`${(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "")}/api/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const account = await readApiJson(response, ui.accountLoadError);
                const current = account.companies?.[0];

                if (!current) {
                    throw new Error(ui.noCompany);
                }

                const options = {
                    token,
                    companyId: current.id,
                    membershipId: current.membership_id,
                };
                setRequestOptions(options);
                setCurrentResponsibleName(
                    `${account.user?.first_name || ""} ${account.user?.last_name || ""}`.trim()
                );

                const [
                    clientData,
                    addressesData,
                    nextActionsData,
                    jobsData,
                    appointmentsData,
                    activitiesData,
                ] = await Promise.all([
                    clientService.get(options, id),
                    clientService.getAddresses(options, id),
                    clientService.getNextActions(options, id),
                    clientService.getJobs(options, id),
                    clientService.getAppointments(options, id),
                    clientService.getActivities(options, id),
                ]);

                setClient(clientData);
                setAddresses(addressesData.items || addressesData || []);
                setNextActions(nextActionsData.items || nextActionsData || []);
                setRelatedJobs(jobsData.items || jobsData || []);
                setClientAppointments(
                    appointmentsData.items || appointmentsData || []
                );
                setRecentActivity(
                    activitiesData.items || activitiesData || []
                );
            } catch (err) {
                setError(err.message || "No se pudo cargar el cliente.");
            } finally {
                setLoading(false);
            }
        };

        loadClient();
    }, [id, ui.accountLoadError, ui.noCompany]);

    const createNextAction = async (event) => {
        event.preventDefault();
        if (!requestOptions?.membershipId) {
            setActionError(translateLiteral("Unable to identify the current responsible person.", locale));
            return;
        }
        try {
            setSavingAction(true);
            setActionError("");
            const created = await clientService.createNextAction(requestOptions, id, {
                title: actionForm.title.trim(),
                description: actionForm.description.trim() || null,
                due_at: new Date(actionForm.dueAt).toISOString(),
                assigned_membership_id: requestOptions.membershipId,
            });
            setNextActions((current) => [...current, created].sort((a, b) => new Date(a.due_at) - new Date(b.due_at)));
            setActionForm(defaultActionForm());
            setShowActionForm(false);
        } catch (failure) {
            setActionError(failure.message || translateLiteral("Unable to create the next action.", locale));
        } finally {
            setSavingAction(false);
        }
    };

    if (loading) {
        return <div className="p-4">Cargando cliente...</div>;
    }

    if (error) {
        return <div className="p-4 text-danger">{error}</div>;
    }

    if (!client) {
        return <div className="p-4">Cliente no encontrado.</div>;
    }

    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    const primaryAddress = addresses.find(address => address.is_primary) || addresses[0];
    const nextAction = nextActions[0];


    return (
        <div className="container-fluid px-0">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <Link to="/clients" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Volver al listado
                </Link>
                <span className="badge px-3 py-2" style={{ backgroundColor: "#198754", color: "#ffffff" }}>
                    Cliente Verificado
                </span>
            </div>

            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body p-4">
                    <div className="row g-4 align-items-center">
                        <div className="col-12 col-lg-8 d-flex align-items-center gap-4">
                            <span
                                aria-hidden="true"
                                className="rounded-circle shadow-sm bg-light text-primary d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                                style={{ width: "90px", height: "90px", fontSize: "2rem" }}
                            >
                                {fullName
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map(part => part[0])
                                    .join("")
                                    .toUpperCase() || "?"}
                            </span>
                            <div>
                                <h2 className="fw-bold text-dark mb-1">{fullName}</h2>
                                <h5 className="text-secondary fs-6 mb-2">
                                    Cliente
                                </h5>
                                <p className="text-secondary small mb-0">
                                    <i className="fa-solid fa-envelope text-primary me-2"></i>
                                    {client.email || "Sin email"} &bull;
                                    <i className="fa-solid fa-phone text-success ms-3 me-2"></i>
                                    {client.phone || "Sin teléfono"}
                                </p>
                            </div>
                        </div>
                        <div className="col-12 col-lg-4">
                            <div className="bg-light p-3 rounded-3 border">
                                <span className="text-secondary small d-block mb-1"><i className="fa-solid fa-location-dot text-danger me-2"></i><strong>Dirección de contacto:</strong></span>
                                <span className="text-dark small">
                                    {primaryAddress
                                        ? `${primaryAddress.line_1}${primaryAddress.line_2 ? `, ${primaryAddress.line_2}` : ""}, ${primaryAddress.city}, ${primaryAddress.postcode}`
                                        : "Sin dirección registrada"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                <div className="col-12 col-xl-8">

                    {/* Próxima Acción (Next Action) */}
                    <div className="card border-0 shadow-sm mb-4 bg-white border-start border-4 border-primary">
                        <div className="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center gap-3">
                            <h5 className="fw-bold text-dark m-0">
                                <i className="fa-solid fa-bolt me-2 text-warning"></i> Próxima Acción Programada
                            </h5>
                            <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-primary text-white px-2 py-1">
                                Due: {nextAction?.due_at
                                    ? new Date(nextAction.due_at).toLocaleDateString(locale)
                                    : "Sin fecha"}
                            </span>
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowActionForm((value) => !value)}>
                                <i className="fa-solid fa-plus me-1"></i>{translateLiteral("Add", locale)}
                            </button>
                            </div>
                        </div>
                        <div className="card-body pt-0">
                            {showActionForm && (
                                <form className="border rounded-3 p-3 mb-3 bg-light" onSubmit={createNextAction}>
                                    <div className="row g-2">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold">{translateLiteral("Title *", locale)}</label>
                                            <input className="form-control form-control-sm" required maxLength="180" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold">{translateLiteral("Date and time *", locale)}</label>
                                            <input type="datetime-local" className="form-control form-control-sm" required value={actionForm.dueAt} onChange={(event) => setActionForm((current) => ({ ...current, dueAt: event.target.value }))} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label small fw-semibold">{translateLiteral("Description", locale)}</label>
                                            <textarea className="form-control form-control-sm" rows="2" value={actionForm.description} onChange={(event) => setActionForm((current) => ({ ...current, description: event.target.value }))}></textarea>
                                        </div>
                                    </div>
                                    {actionError && <div className="alert alert-danger py-2 small mt-2 mb-0">{actionError}</div>}
                                    <div className="d-flex justify-content-end gap-2 mt-3">
                                        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={savingAction} onClick={() => setShowActionForm(false)}>{translateLiteral("Cancel", locale)}</button>
                                        <button type="submit" className="btn btn-sm btn-primary" disabled={savingAction}>{savingAction ? translateLiteral("Saving...", locale) : translateLiteral("Save", locale)}</button>
                                    </div>
                                </form>
                            )}
                            <div className="bg-light p-3 rounded-3 mb-3">
                                <h6 className="fw-bold text-dark mb-1">
                                    {nextAction?.title || "No hay próxima acción programada"}
                                </h6>
                                <p className="text-secondary small mb-2">
                                    {nextAction?.description || "Sin descripción"}
                                </p>
                                <div className="d-flex flex-wrap gap-3 small text-secondary pt-2 border-top border-light">
                                    <span>
                                        <i className="fa-solid fa-user-tie me-1 text-primary"></i>
                                        <strong>Propietario:</strong>{" "}
                                        {nextAction?.assigned_membership_id === requestOptions?.membershipId
                                            ? currentResponsibleName || translateLiteral("Responsible", locale)
                                            : translateLiteral("Unassigned", locale)}
                                    </span>

                                    <span>
                                        <i className="fa-solid fa-link me-1 text-success"></i>
                                        <strong>Relacionado:</strong> Cliente
                                    </span>
                                </div>
                            </div>

                            <div className="border-top border-light pt-3 mt-3">
                                <span className="text-secondary small">
                                    <strong>Estado:</strong>{" "}
                                    {nextAction?.status
                                        ? translateLiteral(
                                            nextAction.status.charAt(0).toUpperCase() + nextAction.status.slice(1),
                                            locale
                                        )
                                        : translateLiteral("No scheduled action", locale)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Trabajos Relacionados */}
                    <div className="card border-0 shadow-sm mb-4 bg-white">
                        <div className="card-header bg-white py-3 border-0">
                            <h5 className="fw-bold text-dark m-0"><i className="fa-solid fa-briefcase me-2 text-primary"></i> Trabajos Relacionados</h5>
                        </div>
                        <div className="card-body pt-0">
                            {relatedJobs.length === 0 ? (
                                <p className="text-secondary small mb-0">
                                    No hay trabajos asociados a este cliente.
                                </p>
                            ) : (
                                relatedJobs.map(job => (
                                    <div
                                        className="p-3 bg-light rounded-2 d-flex justify-content-between align-items-center mb-2"
                                        key={job.id}
                                    >
                                        <div>
                                            <span className="fw-bold text-dark d-block">
                                                {job.title}
                                            </span>

                                            <span className="text-secondary small">
                                                Entrega prevista:{" "}
                                                {job.scheduled_end
                                                    ? new Date(job.scheduled_end).toLocaleDateString(locale)
                                                    : "Sin fecha"}{" "}
                                                &bull; Presupuesto:{" "}
                                                <strong>
                                                    {job.quoted_amount != null
                                                        ? `${Number(job.quoted_amount).toFixed(2)} €`
                                                        : "Sin presupuesto"}
                                                </strong>
                                            </span>
                                        </div>

                                        <Link
                                            to={`/jobs/${job.id}`}
                                            className="btn btn-sm btn-outline-primary"
                                        >
                                            Ver Trabajo
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Citas Programadas (CONECTADAS CON LA AGENDA) */}
                    <div className="card border-0 shadow-sm bg-white">
                        <div className="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold text-dark m-0"><i className="fa-solid fa-calendar-check me-2 text-info"></i> Citas Programadas</h5>
                            <Link to="/agenda" className="text-decoration-none small fw-bold">Ir a la Agenda &rarr;</Link>
                        </div>
                        <div className="card-body pt-0">
                            {clientAppointments.length === 0 ? (
                                <p className="text-secondary small mb-0">
                                    No hay citas registradas en la agenda para este cliente.
                                </p>
                            ) : (
                                clientAppointments.map(app => (
                                    <div
                                        className="p-3 bg-light rounded-2 mb-2 border-start border-4 border-info d-flex justify-content-between align-items-center"
                                        key={app.id}
                                    >
                                        <div>
                                            <span
                                                className="badge bg-secondary mb-1"
                                                style={{ fontSize: "0.65rem" }}
                                            >
                                                {app.status || "Sin estado"}
                                            </span>

                                            <span className="fw-bold text-dark small d-block">
                                                {app.title}
                                            </span>

                                            <span
                                                className="text-secondary"
                                                style={{ fontSize: "0.75rem" }}
                                            >
                                                <i className="fa-solid fa-clock me-1"></i>{" "}
                                                {app.starts_at
                                                    ? new Date(app.starts_at).toLocaleString(locale)
                                                    : "Sin fecha"}{" "}
                                                &bull; Responsable:{" "}
                                                {app.assigned_membership_id || "Sin asignar"}
                                            </span>
                                        </div>

                                        <Link
                                            to={`/agenda?appointmentId=${app.id}`}
                                            className="btn btn-sm btn-outline-info"
                                        >
                                            Ver en Agenda
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>

                <div className="col-12 col-xl-4">

                    {/* Actividad Reciente */}
                    <div className="card border-0 shadow-sm bg-white">
                        <div className="card-header bg-white py-3 border-0">
                            <h5 className="fw-bold text-dark m-0"><i className="fa-solid fa-clock-rotate-left me-2 text-secondary"></i> Actividad Reciente</h5>
                        </div>
                        <div className="card-body pt-0">
                            <div className="timeline">
                                {recentActivity.length === 0 ? (
                                    <p className="text-secondary small mb-0">
                                        No hay actividad registrada para este cliente.
                                    </p>
                                ) : (
                                    recentActivity.map(act => (
                                        <div
                                            className="mb-3 pb-3 border-bottom border-light"
                                            key={act.id}
                                        >
                                            <span
                                                className="text-muted d-block"
                                                style={{ fontSize: "0.7rem" }}
                                            >
                                                {act.created_at
                                                    ? new Date(act.created_at).toLocaleString(locale)
                                                    : "Sin fecha"}
                                            </span>

                                            <span className="text-dark small fw-semibold">
                                                {act.description || act.event_type}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default ClientDetail;
