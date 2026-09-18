import React, { useState } from "react";
import { Link } from "react-router-dom";
import { initialJobs } from "../../data/jobsMockData";

export const Jobs = () => {
    const [jobs, setJobs] = useState(initialJobs);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Estados para el Modal de Nuevo Trabajo
    const [showModal, setShowModal] = useState(false);
    const [newJob, setNewJob] = useState({
        title: "",
        clientName: "Antonio Ruiz",
        clientEmail: "antonio@email.com",
        clientPhone: "600123456",
        address: "Av. de la Constitución 12, 41001 Sevilla",
        budget: 1200,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: "2026-06-30"
    });

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            job.client.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || job.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleCreateJob = (e) => {
        e.preventDefault();
        const createdJob = {
            id: `job-${Date.now()}`,
            title: newJob.title,
            client: {
                name: newJob.clientName,
                email: newJob.clientEmail,
                phone: newJob.clientPhone
            },
            address: newJob.address,
            budget: Number(newJob.budget),
            startDate: newJob.startDate,
            dueDate: newJob.dueDate,
            status: "in_progress",
            progress: 0,
            assignedTeam: ["Carlos Alberto", "Equipo Carpintería"],
            stages: [
                { id: "st-1", name: "Toma de Medidas y Diseño", status: "pending" },
                { id: "st-2", name: "Selección de Materiales", status: "pending" },
                { id: "st-3", name: "Fabricación en Taller", status: "pending" },
                { id: "st-4", name: "Instalación en Domicilio", status: "pending" }
            ],
            appointments: [],
            recentActivity: [
                { id: `act-${Date.now()}`, date: newJob.startDate, description: "Trabajo registrado y creado en el sistema." }
            ]
        };

        setJobs([createdJob, ...jobs]);
        setShowModal(false);
        // Resetear formulario básico
        setNewJob({
            title: "",
            clientName: "Antonio Ruiz",
            clientEmail: "antonio@email.com",
            clientPhone: "600123456",
            address: "Av. de la Constitución 12, 41001 Sevilla",
            budget: 1200,
            startDate: new Date().toISOString().split('T')[0],
            dueDate: "2026-06-30"
        });
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case "completed":
                return (
                    <span 
                        className="badge px-3 py-2 fw-semibold" 
                        style={{ backgroundColor: "#198754", color: "#ffffff", fontSize: "0.8rem" }}
                    >
                        Completado
                    </span>
                );
            case "in_progress":
                return (
                    <span 
                        className="badge px-3 py-2 fw-semibold" 
                        style={{ backgroundColor: "#0d6efd", color: "#ffffff", fontSize: "0.8rem" }}
                    >
                        En curso
                    </span>
                );
            default:
                return (
                    <span 
                        className="badge px-3 py-2 fw-semibold" 
                        style={{ backgroundColor: "#6c757d", color: "#ffffff", fontSize: "0.8rem" }}
                    >
                        Pendiente
                    </span>
                );
        }
    };

    return (
        <div className="container-fluid px-0">
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
                    {filteredJobs.map(job => (
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
                                            <i className="fa-solid fa-user me-2 text-primary"></i><strong className="text-dark">{job.client.name}</strong> &bull; <i className="fa-solid fa-location-dot ms-2 me-1 text-danger"></i>{job.address}
                                        </p>

                                        {/* Barra de progreso */}
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between text-secondary small mb-1">
                                                <span>Progreso de etapas</span>
                                                <span className="fw-semibold text-dark">{job.progress}%</span>
                                            </div>
                                            <div className="progress bg-light" style={{ height: "6px" }}>
                                                <div 
                                                    className="progress-bar rounded-pill" 
                                                    role="progressbar" 
                                                    style={{ width: `${job.progress}%`, backgroundColor: "#635bff" }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Metadatos */}
                                        <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded-2 small text-secondary mb-3">
                                            <div>
                                                <i className="fa-solid fa-euro-sign me-1 text-success"></i>
                                                <span className="fw-bold text-dark">{job.budget.toFixed(2)} €</span>
                                            </div>
                                            <div>
                                                <i className="fa-solid fa-calendar me-1"></i>
                                                <span className="text-dark">Entrega: {job.dueDate}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-end pt-2 border-top border-light">
                                        <Link 
                                            to={`/jobs/${job.id}`} 
                                            className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                                        >
                                            Ver Espacio de Trabajo <i className="fa-solid fa-arrow-right"></i>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
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
                                            onChange={e => setNewJob({...newJob, title: e.target.value})}
                                            placeholder="Ej. Fabricación de Armario Empotrado"
                                        />
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Nombre del Cliente</label>
                                            <input 
                                                type="text" 
                                                className="form-control bg-light text-dark shadow-none" 
                                                required 
                                                value={newJob.clientName}
                                                onChange={e => setNewJob({...newJob, clientName: e.target.value})}
                                            />
                                        </div>
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Presupuesto (€)</label>
                                            <input 
                                                type="number" 
                                                className="form-control bg-light text-dark shadow-none" 
                                                required 
                                                value={newJob.budget}
                                                onChange={e => setNewJob({...newJob, budget: e.target.value})}
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
                                            onChange={e => setNewJob({...newJob, address: e.target.value})}
                                        />
                                    </div>
                                    <div className="row g-2 mb-3">
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Fecha de Inicio</label>
                                            <input 
                                                type="date" 
                                                className="form-control bg-white text-dark border shadow-none cursor-pointer" 
                                                required 
                                                value={newJob.startDate}
                                                onChange={e => setNewJob({...newJob, startDate: e.target.value})}
                                                style={{ cursor: "pointer", colorScheme: "light" }}
                                            />
                                        </div>
                                        <div className="col">
                                            <label className="form-label small fw-semibold text-dark">Fecha de Entrega</label>
                                            <input 
                                                type="date" 
                                                className="form-control bg-white text-dark border shadow-none cursor-pointer" 
                                                required 
                                                value={newJob.dueDate}
                                                onChange={e => setNewJob({...newJob, dueDate: e.target.value})}
                                                style={{ cursor: "pointer", colorScheme: "light" }}
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