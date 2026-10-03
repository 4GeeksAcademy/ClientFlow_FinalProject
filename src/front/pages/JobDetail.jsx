import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { sharedAppointments } from "../../data/sharedAppointments";
import { useLanguage } from "../context/LanguageContext";
import { translateLiteral } from "../i18n/literalTranslations.mjs";
import { readApiJson } from "../services/response.mjs";

export const JobDetail = () => {
    const { locale } = useLanguage();
    const { id } = useParams();
    const location = useLocation();

    const [job, setJob] = useState(location.state?.job || null);
    const [loading, setLoading] = useState(!location.state?.job);
    const [error, setError] = useState("");
    const [savingStatus, setSavingStatus] = useState(false);
    const [showStageForm, setShowStageForm] = useState(false);
    const [stageForm, setStageForm] = useState({ title: "", description: "", dueAt: "" });
    const [savingStage, setSavingStage] = useState(false);
    const displayDate = (value) => value ? String(value).slice(0, 10) : translateLiteral("Por definir", locale);

    // Helper para obtener la URL base limpia y el token de autenticación
    const getBaseUrl = () => (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
    const getToken = () => localStorage.getItem("access_token") || localStorage.getItem("jwt_token") || localStorage.getItem("token");

    // 1. Cargar el detalle del trabajo específico desde la API al montar el componente
    useEffect(() => {
        const fetchJobDetail = async () => {
            try {
                const base = getBaseUrl();
                const token = getToken();
                setError("");

                const accountResponse = await fetch(`${base}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const account = await readApiJson(
                    accountResponse,
                    translateLiteral("Unable to verify your account.", locale)
                );
                const companyId = account.companies?.[0]?.id;
                if (!companyId) {
                    throw new Error("No se encontró una empresa activa.");
                }

                const response = await fetch(`${base}/api/jobs/${id}`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "X-Company-ID": String(companyId),
                    }
                });

                const data = await readApiJson(response, "No se pudo cargar el trabajo.");
                setJob(data);
            } catch (err) {
                setError(err.message || "No se pudo cargar el trabajo.");
                setJob(null);
            } finally {
                setLoading(false);
            }
        };

        fetchJobDetail();
    }, [id, locale]);

    // Filtramos de forma segura las citas de la agenda global que coincidan con este trabajo
    const jobAppointments = sharedAppointments.filter(
        app => app.jobId === id || app.jobId === job?.id
    );

    // 2. Modificar etapa y persistir el cambio en el Backend con autenticación
    const handleStageChange = async (stageId, newStatus) => {
        if (!job || !job.stages) return;

        const updatedStages = job.stages.map(stage => {
            if (stage.id === stageId) {
                return { ...stage, status: newStatus };
            }
            return stage;
        });

        const completedCount = updatedStages.filter(s => s.status === "completed").length;
        const newProgress = Math.round((completedCount / updatedStages.length) * 100);
        const newJobStatus = newProgress === 100 ? "completed" : "in_progress";

        const updatedJobData = {
            ...job,
            stages: updatedStages,
            progress: newProgress,
            status: newJobStatus
        };

        // Actualización optimista en el cliente para respuesta instantánea
        setJob(updatedJobData);

        try {
            const base = getBaseUrl();
            const token = getToken();

            const response = await fetch(`${base}/api/jobs/${id}`, {
                method: "PUT", // O PATCH según tu backend
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "X-Company-ID": String(job.company_id),
                },
                body: JSON.stringify({
                    stages: updatedStages,
                    progress: newProgress,
                    status: newJobStatus
                })
            });

            const data = await readApiJson(response, "No se pudo actualizar la etapa.");
            setJob(data);
        } catch (error) {
            setJob(job);
            setError(error.message || "No se pudo actualizar la etapa.");
        }
    };

    const updateJobStatus = async (newStatus) => {
        const previous = job;
        setJob((current) => ({ ...current, status: newStatus }));
        setSavingStatus(true);
        setError("");
        try {
            const response = await fetch(`${getBaseUrl()}/api/jobs/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                    "X-Company-ID": String(job.company_id),
                },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await readApiJson(
                response,
                translateLiteral("Unable to update the job status.", locale)
            );
            setJob(data);
        } catch (failure) {
            setJob(previous);
            setError(failure.message || "No se pudo actualizar el estado del trabajo.");
        } finally {
            setSavingStatus(false);
        }
    };

    const createStage = async (event) => {
        event.preventDefault();
        setSavingStage(true);
        setError("");
        try {
            const response = await fetch(`${getBaseUrl()}/api/jobs/${id}/stages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                    "X-Company-ID": String(job.company_id),
                },
                body: JSON.stringify({
                    title: stageForm.title.trim(),
                    description: stageForm.description.trim() || null,
                    due_at: stageForm.dueAt || null,
                }),
            });
            const data = await readApiJson(
                response,
                translateLiteral("Unable to create the stage.", locale)
            );
            setJob(data);
            setStageForm({ title: "", description: "", dueAt: "" });
            setShowStageForm(false);
        } catch (failure) {
            setError(failure.message || "No se pudo crear la etapa.");
        } finally {
            setSavingStage(false);
        }
    };

    const getStageBadgeStyle = (status) => {
        switch (status) {
            case "completed":
                return { backgroundColor: "#198754", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.85rem", display: "inline-block" };
            case "in_progress":
                return { backgroundColor: "#0d6efd", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.85rem", display: "inline-block" };
            default:
                return { backgroundColor: "#6c757d", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.85rem", display: "inline-block" };
        }
    };

    const getStageText = (status) => {
        switch (status) {
            case "completed": return translateLiteral("Completado", locale);
            case "in_progress": return translateLiteral("En curso", locale);
            default: return translateLiteral("Pendiente", locale);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    if (!job) return <div className="alert alert-danger m-4" role="alert">{error || "Trabajo no encontrado."}</div>;

    return (
        <div className="container-fluid px-0">
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {/* Navegación superior */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <Link to="/jobs" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Volver al listado
                </Link>
                <div className="d-flex align-items-center gap-2">
                    <label className="small fw-semibold text-secondary" htmlFor="job-status">{translateLiteral("Status", locale)}</label>
                    <select id="job-status" className="form-select form-select-sm" value={job.status} disabled={savingStatus} onChange={(event) => updateJobStatus(event.target.value)}>
                        <option value="draft">{translateLiteral("Draft", locale)}</option>
                        <option value="scheduled">{translateLiteral("Scheduled", locale)}</option>
                        <option value="in_progress">{translateLiteral("In progress", locale)}</option>
                        <option value="review">{translateLiteral("Review", locale)}</option>
                        <option value="completed">{translateLiteral("Completed", locale)}</option>
                        <option value="cancelled">{translateLiteral("Cancelled", locale)}</option>
                    </select>
                </div>
            </div>

            {/* Cabecera Principal */}
            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body p-4">
                    <div className="row g-4 align-items-center">
                        <div className="col-12 col-lg-7">
                            <h2 className="fw-bold text-dark mb-2">{job.title}</h2>
                            <p className="text-secondary mb-3">
                                <i className="fa-solid fa-user text-primary me-2"></i>
                                <strong className="text-dark">{job.client?.name || job.client_name || "Cliente general"}</strong>
                                <span className="text-muted"> ({job.client?.email || job.client_email || "Sin email"} &bull; {job.client?.phone || job.client_phone || "Sin teléfono"})</span>
                            </p>
                            <p className="text-secondary small mb-0">
                                <i className="fa-solid fa-location-dot text-danger me-2"></i>
                                <strong className="text-dark">Ubicación:</strong> {job.address || job.description || "No especificada"}
                            </p>
                        </div>
                        <div className="col-12 col-lg-5">
                            <div className="bg-light p-3 rounded-3 border">
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Presupuesto asignado:</span>
                                    <span className="fw-bold text-success fs-5">{(job.quoted_amount || job.budget || 0).toFixed(2)} €</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Fecha de inicio:</span>
                                    <span className="fw-semibold text-dark small">{displayDate(job.scheduled_start)}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Fecha de entrega:</span>
                                    <span className="fw-semibold text-dark small">{displayDate(job.scheduled_end)}</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span className="text-secondary small">Equipo asignado:</span>
                                    <span className="fw-semibold text-dark small">{Array.isArray(job.assignedTeam) ? job.assignedTeam.join(", ") : "Equipo general"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Progreso General */}
                    <div className="mt-4 pt-3 border-top border-light">
                        <div className="d-flex justify-content-between text-secondary small mb-1">
                            <span className="fw-semibold text-dark">Progreso Operativo General</span>
                            <span className="fw-bold text-primary">{job.progress || 0}%</span>
                        </div>
                        <div className="progress bg-light" style={{ height: "8px" }}>
                            <div
                                className="progress-bar rounded-pill"
                                role="progressbar"
                                style={{ width: `${job.progress || 0}%`, backgroundColor: "var(--cf-brand)" }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid de Secciones */}
            <div className="row g-4">
                {/* Columna Principal Izquierda: Etapas del Proyecto */}
                <div className="col-12 col-xl-8">
                    <div className="card border-0 shadow-sm bg-white">
                        <div className="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center gap-3">
                            <h5 className="fw-bold text-dark m-0">
                                <i className="fa-solid fa-bars-progress me-2 text-primary"></i> Etapas del Proyecto
                            </h5>
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowStageForm((value) => !value)}>
                                <i className="fa-solid fa-plus me-1"></i>{translateLiteral("Add stage", locale)}
                            </button>
                        </div>
                        <div className="card-body pt-0">
                            {showStageForm && <form className="bg-light border rounded-3 p-3 mb-3" onSubmit={createStage}>
                                <div className="row g-2">
                                    <div className="col-12 col-md-6"><label className="form-label small fw-semibold">{translateLiteral("Stage name", locale)} *</label><input className="form-control form-control-sm" required maxLength="160" value={stageForm.title} onChange={(event) => setStageForm((current) => ({ ...current, title: event.target.value }))} /></div>
                                    <div className="col-12 col-md-6"><label className="form-label small fw-semibold">{translateLiteral("Due date", locale)}</label><input type="date" className="form-control form-control-sm" value={stageForm.dueAt} onChange={(event) => setStageForm((current) => ({ ...current, dueAt: event.target.value }))} /></div>
                                    <div className="col-12"><label className="form-label small fw-semibold">{translateLiteral("Description", locale)}</label><textarea className="form-control form-control-sm" rows="2" maxLength="4000" value={stageForm.description} onChange={(event) => setStageForm((current) => ({ ...current, description: event.target.value }))}></textarea></div>
                                </div>
                                <div className="d-flex justify-content-end gap-2 mt-3"><button type="button" className="btn btn-sm btn-outline-secondary" disabled={savingStage} onClick={() => setShowStageForm(false)}>{translateLiteral("Cancel", locale)}</button><button className="btn btn-sm btn-primary" disabled={savingStage}>{savingStage ? translateLiteral("Saving...", locale) : translateLiteral("Save", locale)}</button></div>
                            </form>}
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead>
                                        <tr className="bg-light">
                                            <th className="py-3 border-bottom text-dark fw-bold">#</th>
                                            <th className="py-3 border-bottom text-dark fw-bold">Nombre de la Etapa</th>
                                            <th className="py-3 border-bottom text-dark fw-bold">Estado Actual</th>
                                            <th className="py-3 border-bottom text-dark fw-bold text-end">Acciones / Marcar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {job.stages && job.stages.length > 0 ? (
                                            job.stages.map((stage, index) => (
                                                <tr key={stage.id}>
                                                    <td className="py-3 fw-bold text-dark">0{index + 1}</td>
                                                    <td className="py-3 fw-semibold text-dark">{stage.name}</td>
                                                    <td className="py-3">
                                                        <span style={getStageBadgeStyle(stage.status)}>
                                                            {getStageText(stage.status)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-end">
                                                        <div className="btn-group btn-group-sm">
                                                            <button
                                                                className={`btn btn-outline-secondary ${stage.status === 'pending' ? 'active' : ''}`}
                                                                onClick={() => handleStageChange(stage.id, 'pending')}
                                                            >
                                                                Pendiente
                                                            </button>
                                                            <button
                                                                className={`btn btn-outline-primary ${stage.status === 'in_progress' ? 'active' : ''}`}
                                                                onClick={() => handleStageChange(stage.id, 'in_progress')}
                                                            >
                                                                En curso
                                                            </button>
                                                            <button
                                                                className={`btn btn-outline-success ${stage.status === 'completed' ? 'active' : ''}`}
                                                                onClick={() => handleStageChange(stage.id, 'completed')}
                                                            >
                                                                Completado
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="text-center py-4 text-secondary">No hay etapas registradas para este trabajo.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Citas Relacionadas y Actividad Reciente */}
                <div className="col-12 col-xl-4">
                    {/* Citas Relacionadas */}
                    <div className="card border-0 shadow-sm mb-4 bg-white">
                        <div className="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold text-dark m-0">
                                <i className="fa-solid fa-calendar-check me-2 text-info"></i> Citas Relacionadas
                            </h5>
                            <Link to="/agenda" className="text-decoration-none small fw-bold">Ver Agenda</Link>
                        </div>
                        <div className="card-body pt-0">
                            {jobAppointments.length === 0 ? (
                                <p className="text-secondary small mb-0">No hay citas registradas para este trabajo.</p>
                            ) : (
                                jobAppointments.map(app => (
                                    <div className="p-3 bg-light rounded-2 mb-2 border-start border-4 border-primary d-flex justify-content-between align-items-center" key={app.id}>
                                        <div>
                                            <span className="fw-bold text-dark small d-block">{app.title}</span>
                                            <span className="text-secondary" style={{ fontSize: "0.75rem" }}>
                                                <i className="fa-solid fa-clock me-1"></i> {app.date} a las {app.time}
                                            </span>
                                        </div>
                                        <Link to={`/agenda?appointmentId=${app.id}`} className="btn btn-sm btn-outline-primary">Abrir</Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Actividad Reciente */}
                    <div className="card border-0 shadow-sm bg-white">
                        <div className="card-header bg-white py-3 border-0">
                            <h5 className="fw-bold text-dark m-0">
                                <i className="fa-solid fa-clock-rotate-left me-2 text-secondary"></i> Actividad Reciente
                            </h5>
                        </div>
                        <div className="card-body pt-0">
                            <div className="timeline">
                                {job.recentActivity && job.recentActivity.length > 0 ? (
                                    job.recentActivity.map(act => (
                                        <div className="mb-3 pb-3 border-bottom border-light" key={act.id}>
                                            <span className="text-muted d-block" style={{ fontSize: "0.7rem" }}>{act.date}</span>
                                            <span className="text-dark small fw-semibold">{act.description}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-secondary small mb-0">No hay actividad reciente registrada.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobDetail;
