import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { initialJobs } from "../../data/jobsMockData";

export const JobDetail = () => {
    const { id } = useParams();
    const [job, setJob] = useState(initialJobs.find(j => j.id === id) || initialJobs[0]);

    const handleStageChange = (stageId, newStatus) => {
        const updatedStages = job.stages.map(stage => {
            if (stage.id === stageId) {
                return { ...stage, status: newStatus };
            }
            return stage;
        });

        const completedCount = updatedStages.filter(s => s.status === "completed").length;
        const newProgress = Math.round((completedCount / updatedStages.length) * 100);

        setJob({
            ...job,
            stages: updatedStages,
            progress: newProgress,
            status: newProgress === 100 ? "completed" : "in_progress"
        });
    };

    // Estilos fijos para los badges de estado para evitar conflictos de color
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
                                <i className="fa-solid fa-user text-primary me-2"></i><strong className="text-dark">{job.client.name}</strong> <span className="text-muted">({job.client.email} &bull; {job.client.phone})</span>
                            </p>
                            <p className="text-secondary small mb-0">
                                <i className="fa-solid fa-location-dot text-danger me-2"></i><strong className="text-dark">Ubicación:</strong> {job.address}
                            </p>
                        </div>
                        <div className="col-12 col-lg-5">
                            <div className="bg-light p-3 rounded-3 border">
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Presupuesto asignado:</span>
                                    <span className="fw-bold text-success fs-5">{job.budget.toFixed(2)} €</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Fecha de inicio:</span>
                                    <span className="fw-semibold text-dark small">{job.startDate}</span>
                                </div>
                                <div className="d-flex justify-content-between mb-2">
                                    <span className="text-secondary small">Fecha de entrega:</span>
                                    <span className="fw-semibold text-dark small">{job.dueDate}</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span className="text-secondary small">Equipo asignado:</span>
                                    <span className="fw-semibold text-dark small">{job.assignedTeam.join(", ")}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Barra de Progreso General */}
                    <div className="mt-4 pt-3 border-top border-light">
                        <div className="d-flex justify-content-between text-secondary small mb-1">
                            <span className="fw-semibold text-dark">Progreso Operativo General</span>
                            <span className="fw-bold text-primary">{job.progress}%</span>
                        </div>
                        <div className="progress bg-light" style={{ height: "8px" }}>
                            <div 
                                className="progress-bar rounded-pill" 
                                role="progressbar" 
                                style={{ width: `${job.progress}%`, backgroundColor: "#635bff" }}
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
                                        {job.stages.map((stage, index) => (
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
                                        ))}
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
                        <div className="card-header bg-white py-3 border-0">
                            <h5 className="fw-bold text-dark m-0">
                                <i className="fa-solid fa-calendar-check me-2 text-info"></i> Citas Relacionadas
                            </h5>
                        </div>
                        <div className="card-body pt-0">
                            {job.appointments.map(app => (
                                <div className="p-3 bg-light rounded-2 mb-2 border-start border-4 border-primary" key={app.id}>
                                    <span className="fw-bold text-dark small d-block">{app.title}</span>
                                    <span className="text-secondary" style={{ fontSize: "0.75rem" }}>
                                        <i className="fa-solid fa-clock me-1"></i> {app.date}
                                    </span>
                                </div>
                            ))}
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
                                {job.recentActivity.map(act => (
                                    <div className="mb-3 pb-3 border-bottom border-light" key={act.id}>
                                        <span className="text-muted d-block" style={{ fontSize: "0.7rem" }}>{act.date}</span>
                                        <span className="text-dark small fw-semibold">{act.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default JobDetail;