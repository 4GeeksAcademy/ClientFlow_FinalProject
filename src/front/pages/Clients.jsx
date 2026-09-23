import React, { useState } from "react";
import { Link } from "react-router-dom";
import { initialClients } from "../../data/clientsMockData";

export const Clients = () => {
    const [clients] = useState(initialClients);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const filteredClients = clients.filter(client => {
        const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              client.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || client.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status) => {
        switch(status) {
            case "active":
                return <span className="badge px-2 py-1" style={{ backgroundColor: "#198754", color: "#ffffff" }}>Activo</span>;
            case "lead":
                return <span className="badge px-2 py-1" style={{ backgroundColor: "#0d6efd", color: "#ffffff" }}>Lead</span>;
            default:
                return <span className="badge px-2 py-1" style={{ backgroundColor: "#6c757d", color: "#ffffff" }}>Inactivo</span>;
        }
    };

    return (
        <div className="container-fluid px-0">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Gestión de Clientes</h2>
                    <p className="text-secondary small mb-0">Directorio de clientes, historial de encargos y próximas acciones.</p>
                </div>
                <div>
                    <button className="btn btn-primary d-flex align-items-center gap-2 shadow-sm" style={{ backgroundColor: "#635bff", border: "none" }}>
                        <i className="fa-solid fa-user-plus"></i> Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-center">
                    <div className="input-group" style={{ maxWidth: "350px" }}>
                        <span className="input-group-text bg-light border-end-0 text-secondary">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input 
                            type="text" 
                            className="form-control border-start-0 bg-light text-dark shadow-none" 
                            placeholder="Buscar por nombre, empresa..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <select 
                            className="form-select bg-light text-dark shadow-none"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Activos</option>
                            <option value="lead">Leads</option>
                            <option value="inactive">Inactivos</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {filteredClients.map(client => (
                    <div className="col-12 col-xl-6" key={client.id}>
                        <div className="card border-0 shadow-sm h-100 bg-white">
                            <div className="card-body d-flex flex-column justify-content-between p-4">
                                <div>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="d-flex align-items-center gap-3">
                                            <img src={client.avatar} alt={client.name} className="rounded-circle" style={{ width: "50px", height: "50px", objectFit: "cover" }} />
                                            <div>
                                                <h5 className="fw-bold text-dark mb-0">{client.name}</h5>
                                                <span className="text-secondary small">{client.company}</span>
                                            </div>
                                        </div>
                                        {getStatusBadge(client.status)}
                                    </div>

                                    <div className="bg-light p-3 rounded-2 mb-3">
                                        <p className="text-secondary small mb-1">
                                            <i className="fa-solid fa-envelope me-2 text-primary"></i>{client.email}
                                        </p>
                                        <p className="text-secondary small mb-1">
                                            <i className="fa-solid fa-phone me-2 text-success"></i>{client.phone}
                                        </p>
                                        <p className="text-secondary small mb-0">
                                            <i className="fa-solid fa-location-dot me-2 text-danger"></i>{client.address}
                                        </p>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center pt-3 border-top border-light">
                                    <span className="text-muted small">
                                        <i className="fa-solid fa-briefcase me-1"></i> {client.relatedJobs.length} trabajos &bull; <i className="fa-solid fa-calendar me-1"></i> {client.appointments.length} citas
                                    </span>
                                    <Link 
                                        to={`/clients/${client.id}`} 
                                        className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                                    >
                                        Ver Detalles <i className="fa-solid fa-arrow-right"></i>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Clients;