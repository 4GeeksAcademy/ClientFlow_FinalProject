import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export const Jobs = () => {
    const [jobs, setJobs] = useState([]);
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [reload, setReload] = useState(0);

    // Estados para el Modal de Nuevo Trabajo
    const [showModal, setShowModal] = useState(false);
    const [newJob, setNewJob] = useState({
        title: "",
        client_id: "",
        address: "",
        budget: 0,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: "2026-06-30"
    });

    // 1. Cargar trabajos y clientes reales usando el mismo flujo de autenticación de la app
    useEffect(() => {
        const controller = new AbortController();
        const loadJobsAndClients = async () => {
            const token = localStorage.getItem("access_token") || localStorage.getItem("jwt_token") || localStorage.getItem("token");

            try {
                const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

                // Obtenemos la compañía activa del usuario logueado
                const meResponse = await fetch(`${base}/api/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    signal: controller.signal
                });

                if (!meResponse.ok) throw new Error("No se pudo cargar la cuenta.");
                const account = await meResponse.json();
                const current = account.companies?.[0];

                if (!current) {
                    throw new Error("No se encontró una empresa activa.");
                }

                const companyId = current.id;

                // Cargamos los trabajos de la compañía
                const jobsRes = await fetch(`${base}/api/jobs?company_id=${companyId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "X-Company-ID": String(companyId)
                    },
                    signal: controller.signal
                });

                if (jobsRes.ok) {
                    const jobsData = await jobsRes.json();
                    if (Array.isArray(jobsData)) {
                        setJobs(jobsData);
                    }
                }

                // Cargamos los clientes de la compañía para el selector del modal
                const clientsRes = await fetch(`${base}/api/clients?company_id=${companyId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "X-Company-ID": String(companyId)
                    },
                    signal: controller.signal
                });

                if (clientsRes.ok) {
                    const clientsData = await clientsRes.json();
                    const clientList = clientsData.items || clientsData.clients || (Array.isArray(clientsData) ? clientsData : []);
                    setClients(clientList);
                }

            } catch (err) {
                if (!controller.signal.aborted) {
                    console.error("Error cargando datos:", err);
                }
            }
        };

        loadJobsAndClients();
        return () => controller.abort();
    }, [reload]);

    // Función para eliminar un trabajo
    const handleDeleteJob = async (jobId) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar este trabajo?")) return;

        try {
            const token = localStorage.getItem("access_token") || localStorage.getItem("jwt_token") || localStorage.getItem("token");
            const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

            const meResponse = await fetch(`${base}/api/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const account = await meResponse.json();
            const companyId = account.companies?.[0]?.id || 1;

            const response = await fetch(`${base}/api/jobs/${jobId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Company-ID": String(companyId)
                }
            });

            if (response.ok) {
                setReload(value => value + 1);
            } else {
                const errData = await response.json();
                alert(`No se pudo eliminar el trabajo: ${errData.error || "Error desconocido"}`);
            }
        } catch (error) {
            console.error("Error de red al eliminar el trabajo:", error);
            alert("Error de red al intentar eliminar el trabajo.");
        }
    };

    const filteredJobs = jobs.filter(job => {
        const jobTitle = job.title || "";
        const clientName = job.client?.name || job.client_name || "";

        const matchesSearch = jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            clientName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || job.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // 2. Enviar el nuevo trabajo mediante POST al backend omitiendo estados custom para usar los por defecto
    const handleCreateJob = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("access_token") || localStorage.getItem("jwt_token") || localStorage.getItem("token");
            const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

            const meResponse = await fetch(`${base}/api/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const account = await meResponse.json();
            const companyId = account.companies?.[0]?.id || 1;

            const response = await fetch(`${base}/api/jobs`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "X-Company-ID": String(companyId)
                },
                body: JSON.stringify({
                    title: newJob.title,
                    company_id: companyId,
                    client_id: newJob.client_id ? Number(newJob.client_id) : null,
                    quoted_amount: Number(newJob.budget),
                    description: `Obra en ${newJob.address}`,
                    start_date: newJob.startDate,
                    due_date: newJob.dueDate
                })
            });

            if (response.ok) {
                setShowModal(false);
                setReload(value => value + 1);
                setNewJob({
                    title: "",
                    client_id: "",
                    address: "",
                    budget: 0,
                    startDate: new Date().toISOString().split('T')[0],
                    dueDate: "2026-06-30"
                });
            } else {
                const errData = await response.json();
                console.error("Error al crear el trabajo:", errData);
                alert(`No se pudo crear el trabajo: ${errData.error || JSON.stringify(errData)}`);
            }
        } catch (error) {
            console.error("Error de red al crear el trabajo:", error);
        }
    };

    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case "completed":
                return (
                    <span className="badge px-3 py-2 fw-semibold" style={{ backgroundColor: "#198754", color: "#ffffff", fontSize: "0.8rem" }}>
                        Completado
                    </span>
                );
            case "in_progress":
                return (
                    <span className="badge px-3 py-2 fw-semibold" style={{ backgroundColor: "#0d6efd", color: "#ffffff", fontSize: "0.8rem" }}>
                        En curso
                    </span>
                );
            default:
                return (
                    <span className="badge px-3 py-2 fw-semibold" style={{ backgroundColor: "#6c757d", color: "#ffffff", fontSize: "0.8rem" }}>
                        Pendiente
                    </span>
                );
        }
    };

    return (
        <div className="container-fluid px-0">
            {/* Estilo para asegurar que el icono del calendario se vea oscuro */}
            <style>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(0.8) !important;
                    opacity: 1 !important;
                    cursor: pointer;
                }
            `}</style>

            {/* Cabecera */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Gestión de Trabajos</h2>
                    <p className="text-secondary small mb-0">Control operativo de encargos, etapas, materiales y entregables.</p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-primary d-flex align-items-center gap-2 shadow-sm"
                        style={{ backgroundColor: "#635bff", border: "none" }}
                        onClick={() => setShowModal(true)}
                    >
                        <i className="fa-solid fa-plus"></i> Nuevo Trabajo
                    </button>
                </div>
            </div>

            {/* Filtros y Buscador */}
            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-center">
                    <div className="input-group" style={{ maxWidth: "350px" }}>
                        <span className="input-group-text bg-light border-end-0 text-secondary">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0 bg-light text-dark shadow-none"
                            placeholder="Buscar por título o cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="d-flex gap-2 w-100 w-md-auto justify-content-end">
                        <select
                            className="form-select bg-light text-dark shadow-none"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="pending">Pendientes</option>
                            <option value="in_progress">En curso</option>
                            <option value="completed">Completados</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Listado */}
            {filteredJobs.length === 0 ? (
                <div className="text-center py-5 card border-0 shadow-sm bg-white">
                    <div className="card-body">
                        <i className="fa-solid fa-hammer text-muted fs-1 mb-3"></i>
                        <h5 className="fw-bold text-dark">No se encontraron trabajos</h5>
                        <p className="text-secondary small">Intenta ajustar los filtros de búsqueda o crea un nuevo trabajo.</p>
                    </div>
                </div>
            ) : (
                <div className="row g-3">
                    {filteredJobs.map(job => {
                        const clientFullName = job.client ? `${job.client.first_name || ""} ${job.client.last_name || ""}`.trim() : (job.client_name || "Cliente general");
                        return (
                            <div className="col-12 col-xl-6" key={job.id}>
                                <div className="card border-0 shadow-sm h-100 bg-white">
                                    <div className="card-body d-flex flex-column justify-content-between">
                                        <div>
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>ID: {job.id}</span>
                                                    <h5 className="fw-bold text-dark mb-1">{job.title}</h5>
                                                </div>
                                                {getStatusBadge(job.status)}
                                            </div>

                                            <p className="text-secondary small mb-3">
                                                <i className="fa-solid fa-user me-2 text-primary"></i>
                                                <strong className="text-dark">{clientFullName}</strong> &bull;
                                                <i className="fa-solid fa-location-dot ms-2 me-1 text-danger"></i>
                                                {job.address || job.description || "Dirección no especificada"}
                                            </p>

                                            {/* Barra de progreso */}
                                            <div className="mb-3">
                                                <div className="d-flex justify-content-between text-secondary small mb-1">
                                                    <span>Progreso de etapas</span>
                                                    <span className="fw-semibold text-dark">{job.progress || 0}%</span>
                                                </div>
                                                <div className="progress bg-light" style={{ height: "6px" }}>
                                                    <div
                                                        className="progress-bar rounded-pill"
                                                        role="progressbar"
                                                        style={{ width: `${job.progress || 0}%`, backgroundColor: "#635bff" }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Metadatos */}
                                            <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded-2 small text-secondary mb-3">
                                                <div>
                                                    <i className="fa-solid fa-euro-sign me-1 text-success"></i>
                                                    <span className="fw-bold text-dark">{(job.quoted_amount || job.budget || 0).toFixed(2)} €</span>
                                                </div>
                                                <div>
                                                    <i className="fa-solid fa-calendar me-1"></i>
                                                    <span className="text-dark">Entrega: {job.dueDate || job.due_date || "Por definir"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light">
                                            <Link
                                                to={`/jobs/${job.id}`} state={{ job }}
                                                className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                                            >
                                                Ver Espacio de Trabajo <i className="fa-solid fa-arrow-right"></i>
                                            </Link>
                                            <button
                                                className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2"
                                                onClick={() => handleDeleteJob(job.id)}
                                            >
                                                <i className="fa-solid fa-trash-can"></i> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal para Crear Nuevo Trabajo */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow bg-white">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="fw-bold text-dark">Registrar Nuevo Trabajo</h5>
                                <button type="button" className="btn-close shadow-none" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleCreateJob}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">Título del Encargo / Trabajo</label>
                                        <input
                                            type="text"
                                            className="form-control bg-light text-dark shadow-none"
                                            required
                                            value={newJob.title}
                                            onChange={e => setNewJob({ ...newJob, title: e.target.value })}
                                            placeholder="Ej. Fabricación de Armario Empotrado"
                                        />
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold text-dark">Cliente</label>
                                            <select
                                                className="form-select bg-light text-dark shadow-none"
                                                required
                                                value={newJob.client_id}
                                                onChange={e => setNewJob({ ...newJob, client_id: e.target.value })}
                                            >
                                                <option value="">Seleccionar cliente...</option>
                                                {clients.map(client => {
                                                    const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.email;
                                                    return (
                                                        <option key={client.id} value={client.id}>
                                                            {clientName}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold text-dark">Presupuesto (€)</label>
                                            <input
                                                type="number"
                                                className="form-control bg-light text-dark shadow-none"
                                                required
                                                value={newJob.budget}
                                                onChange={e => setNewJob({ ...newJob, budget: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">Dirección de la Obra</label>
                                        <input
                                            type="text"
                                            className="form-control bg-light text-dark shadow-none"
                                            required
                                            value={newJob.address}
                                            onChange={e => setNewJob({ ...newJob, address: e.target.value })}
                                            placeholder="Ej. Av. de la Constitución 12, 41001 Sevilla"
                                        />
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Fecha de Inicio</label>
                                            <input
                                                type="date"
                                                className="form-control bg-light text-dark shadow-none"
                                                required
                                                value={newJob.startDate}
                                                onChange={e => setNewJob({ ...newJob, startDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Fecha de Entrega</label>
                                            <input
                                                type="date"
                                                className="form-control bg-light text-dark shadow-none"
                                                required
                                                value={newJob.dueDate}
                                                onChange={e => setNewJob({ ...newJob, dueDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0 pt-0">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary btn-sm px-4" style={{ backgroundColor: "#635bff", border: "none" }}>Guardar Trabajo</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Jobs;