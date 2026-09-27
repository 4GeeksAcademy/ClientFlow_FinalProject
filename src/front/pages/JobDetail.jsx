import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { sharedAppointments } from "../../data/sharedAppointments";

export const JobDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    
    const [job, setJob] = useState(location.state?.job || null);
    const [loading, setLoading] = useState(!location.state?.job);

    // Helper para obtener la URL base limpia y el token de autenticación
    const getBaseUrl = () => (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
    const getToken = () => localStorage.getItem("access_token") || localStorage.getItem("jwt_token") || localStorage.getItem("token");

    // 1. Cargar el detalle del trabajo específico desde la API al montar el componente
    useEffect(() => {
        const fetchJobDetail = async () => {
            try {
                const base = getBaseUrl();
                const token = getToken();

                const response = await fetch(`${base}/api/jobs/${id}`, {
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    }
                });

                if (!response.ok) throw new Error("No se pudo cargar el trabajo");
                const data = await response.json();
                setJob(data);
            } catch (err) {
                console.error("Error cargando el detalle del trabajo:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchJobDetail();
    }, [id]);

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
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    stages: updatedStages,
                    progress: newProgress,
                    status: newJobStatus
                })
            });

            if (!response.ok) {
                console.error("Error al actualizar la etapa en el servidor");
            }
        } catch (error) {
            console.error("Error de red al actualizar la etapa:", error);
        }
    };

    const getStageBadgeStyle = (status) => {
        switch(status) {
            case "completed":
                return { backgroundColor: "#198754", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.85rem", display: "inline-block" };
            case "in_progress":
                return { backgroundColor: "#0d6efd", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.85rem", display: "inline-block" };
            default:
                return { backgroundColor: "#6c757d", color: "#ffffff", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.85rem", display: "inline-block" };
        }
    };

    const getStageText = (status) => {
        switch(status) {
            case "completed": return "Completado";
            case "in_progress": return "En curso";
            default: return "Pendiente";
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

    if (!job) return <div className="alert alert-danger m-4" role="alert">Trabajo no encontrado.</div>;

    return (
        <div className="container-fluid px-0">
            {/* Navegación superior */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <Link to="/jobs" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Volver al listado
                </Link>
                <div>
                    <span className={`badge px-3 py-2 fs-6 ${job.status === "completed" ? "bg-success text-white" : "bg-primary text-white"}`}>
                        {job.status === "completed" ? "Trabajo Completado y Entregado" : "Trabajo en Curso"}
                    </span>
                </div>
            </div>

            {/* Cabecera Principal */}
            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body p-4">
                    <div className="row g-4 align-items-center">
                        <div className="col-12 col-lg-7">
                            <span className="text-muted small fw-semibold">ID: {job.id}</span>
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
                                    <span className="fw-semibold text-dark small">{job.startDate || job.start_date || "Por definir"}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Fecha de entrega:</span>
                                    <span className="fw-semibold text-dark small">{job.dueDate || job.due_date || "Por definir"}</span>
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
                                style={{ width: `${job.progress || 0}%`, backgroundColor: "#635bff" }}
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
                        <div className="card-header bg-white py-3 border-0">
                            <h5 className="fw-bold text-dark m-0">
                                <i className="fa-solid fa-bars-progress me-2 text-primary"></i> Etapas del Proyecto
                            </h5>
                        </div>
                        <div className="card-body pt-0">
                            <div className="table-responsive">
                                <table className="table align-middle mb-0" style={{ backgroundColor: "#ffffff", color: "#212529" }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "#f8f9fa" }}>
                                            <th className="py-3 border-bottom text-dark fw-bold" style={{ backgroundColor: "#f8f9fa" }}>#</th>
                                            <th className="py-3 border-bottom text-dark fw-bold" style={{ backgroundColor: "#f8f9fa" }}>Nombre de la Etapa</th>
                                            <th className="py-3 border-bottom text-dark fw-bold" style={{ backgroundColor: "#f8f9fa" }}>Estado Actual</th>
                                            <th className="py-3 border-bottom text-dark fw-bold text-end" style={{ backgroundColor: "#f8f9fa" }}>Acciones / Marcar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {job.stages && job.stages.length > 0 ? (
                                            job.stages.map((stage, index) => (
                                                <tr key={stage.id} style={{ backgroundColor: "#ffffff" }}>
                                                    <td className="py-3 fw-bold text-dark" style={{ backgroundColor: "#ffffff" }}>0{index + 1}</td>
                                                    <td className="py-3 fw-semibold text-dark" style={{ backgroundColor: "#ffffff" }}>{stage.name}</td>
                                                    <td className="py-3" style={{ backgroundColor: "#ffffff" }}>
                                                        <span style={getStageBadgeStyle(stage.status)}>
                                                            {getStageText(stage.status)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-end" style={{ backgroundColor: "#ffffff" }}>
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