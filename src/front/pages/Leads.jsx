import React, { useState } from "react";
import { initialLeads } from "../../data/leadsMockData";

export const Leads = () => {
    const [leads, setLeads] = useState(initialLeads);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedLead, setSelectedLead] = useState(null);
    
    // Estados para los filtros avanzados
    const [filterOrigin, setFilterOrigin] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterZone, setFilterZone] = useState("");
    const [filterAssigned, setFilterAssigned] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Estado para el Modal de Creación
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newLead, setNewLead] = useState({
        name: "",
        email: "",
        phone: "",
        origin: "WhatsApp",
        service: "",
        serviceZone: "",
        priority: "Media",
        assignedUser: "Carlos Alberto",
        description: "",
        internalNotes: ""
    });

    // Lógica de filtrado combinada
    const filteredLeads = leads.filter(lead => {
        const matchesSearch = 
            lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesOrigin = filterOrigin === "" || lead.origin === filterOrigin;
        const matchesStatus = filterStatus === "" || lead.status === filterStatus;
        const matchesZone = filterZone === "" || (lead.serviceZone && lead.serviceZone.toLowerCase().includes(filterZone.toLowerCase()));
        const matchesAssigned = filterAssigned === "" || lead.assignedUser === filterAssigned;

        return matchesSearch && matchesOrigin && matchesStatus && matchesZone && matchesAssigned;
    });

    const getStatusBadge = (status) => {
        switch (status) {
            case "Nuevo": return "bg-info bg-opacity-10 text-info border border-info border-opacity-25";
            case "Calificado": return "bg-success bg-opacity-10 text-success border border-success border-opacity-25";
            case "Contactado": return "bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25";
            case "Presupuesto": return "bg-warning bg-opacity-10 text-warning text-dark border border-warning border-opacity-25";
            default: return "bg-secondary bg-opacity-10 text-secondary";
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewLead(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateLead = (e) => {
        e.preventDefault();
        if (!newLead.name || !newLead.service) {
            alert("Por favor, introduce al menos el nombre y el servicio.");
            return;
        }

        const leadToAdd = {
            id: leads.length + 1,
            ...newLead,
            status: "Nuevo",
            recentInteractions: [
                { date: "Hoy", type: "Sistema", notes: "Lead creado manualmente en la plataforma." }
            ],
            nextAction: {
                date: "Pendiente",
                owner: newLead.assignedUser,
                description: "Contactar por primera vez con el cliente."
            }
        };

        setLeads([leadToAdd, ...leads]);
        setNewLead({
            name: "",
            email: "",
            phone: "",
            origin: "WhatsApp",
            service: "",
            serviceZone: "",
            priority: "Media",
            assignedUser: "Carlos Alberto",
            description: "",
            internalNotes: ""
        });
        setShowCreateModal(false);
    };

    const clearFilters = () => {
        setSearchTerm("");
        setFilterOrigin("");
        setFilterStatus("");
        setFilterZone("");
        setFilterAssigned("");
    };

    return (
        <div data-bs-theme="light" className="container-fluid px-4 py-4" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", color: "#212529" }}>
            <div className="container px-0">
                
                {/* Cabecera del Módulo */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <span className="text-uppercase text-muted fw-bold" style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}>
                            CLIENTFLOW • CARPINTERÍA SEVILLA
                        </span>
                        <h2 className="fw-bold text-dark mb-1">Leads</h2>
                        <p className="text-secondary small mb-0">Gestiona y convierte nuevas oportunidades.</p>
                    </div>
                    <button 
                        className="btn btn-primary px-3 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" 
                        style={{ backgroundColor: "#635bff", border: "none" }}
                        onClick={() => setShowCreateModal(true)}
                    >
                        <i className="fa-solid fa-plus"></i> Crear nuevo
                    </button>
                </div>

                {/* Barra de búsqueda y botón de filtros */}
                <div className="card border-0 shadow-sm p-2 mb-3 bg-white rounded-3">
                    <div className="input-group align-items-center">
                        <span className="input-group-text bg-transparent border-0 text-muted ps-3">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <input 
                            type="text" 
                            className="form-control border-0 shadow-none bg-white text-dark" 
                            placeholder="Buscar por nombre, servicio, origen..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button 
                            className={`btn border-0 text-secondary d-flex align-items-center gap-1 px-3 py-2 rounded-2 ${showFilters ? 'bg-light fw-bold text-primary' : 'bg-transparent'}`} 
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <i className="fa-solid fa-filter"></i> Filtros <span>{showFilters ? '▲' : '▼'}</span>
                        </button>
                    </div>
                </div>

                {/* Panel desplegable de Filtros Avanzados */}
                {showFilters && (
                    <div className="card border-0 shadow-sm p-3 mb-3 bg-white rounded-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold text-dark mb-0 fs-6">Filtros Avanzados</h6>
                            <button className="btn btn-sm btn-outline-secondary px-3" onClick={clearFilters}>
                                <i className="fa-solid fa-rotate-left me-1"></i> Limpiar filtros
                            </button>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label small fw-semibold text-secondary">Origen</label>
                                <select className="form-select form-select-sm bg-white text-dark" value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)}>
                                    <option value="">Todos los orígenes</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="Web">Web</option>
                                    <option value="Llamada">Llamada</option>
                                    <option value="Referido">Referido</option>
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-semibold text-secondary">Estado</label>
                                <select className="form-select form-select-sm bg-white text-dark" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                    <option value="">Todos los estados</option>
                                    <option value="Nuevo">Nuevo</option>
                                    <option value="Calificado">Calificado</option>
                                    <option value="Contactado">Contactado</option>
                                    <option value="Presupuesto">Presupuesto</option>
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-semibold text-secondary">Zona de servicio</label>
                                <input 
                                    type="text" 
                                    className="form-control form-control-sm bg-white text-dark" 
                                    placeholder="Ej. Sevilla Centro" 
                                    value={filterZone} 
                                    onChange={(e) => setFilterZone(e.target.value)} 
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label small fw-semibold text-secondary">Asignado a</label>
                                <select className="form-select form-select-sm bg-white text-dark" value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
                                    <option value="">Todos los usuarios</option>
                                    <option value="Carlos Alberto">Carlos Alberto</option>
                                    <option value="Ana Gómez">Ana Gómez</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabla de Leads */}
                <div className="card border-0 shadow-sm bg-white rounded-3 overflow-hidden">
                    <div className="table-responsive">
                        <table className="table align-middle mb-0" style={{ backgroundColor: "#ffffff" }}>
                            <thead className="table-light text-secondary text-uppercase" style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}>
                                <tr>
                                    <th className="py-3 px-4 bg-light text-secondary">Nombre</th>
                                    <th className="py-3 bg-light text-secondary">Origen</th>
                                    <th className="py-3 bg-light text-secondary">Servicio</th>
                                    <th className="py-3 bg-light text-secondary">Estado</th>
                                    <th className="py-3 text-end px-4 bg-light text-secondary">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeads.length > 0 ? (
                                    filteredLeads.map((lead) => (
                                        <tr 
                                            key={lead.id} 
                                            onClick={() => setSelectedLead(lead)} 
                                            style={{ cursor: "pointer", backgroundColor: "#ffffff" }}
                                            className="border-bottom"
                                        >
                                            <td className="px-4 py-3 bg-white">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center" style={{ width: "36px", height: "36px", fontSize: "0.85rem" }}>
                                                        {lead.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="fw-semibold text-dark">{lead.name}</div>
                                                        <div className="text-muted small" style={{ fontSize: "0.75rem" }}>{lead.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="bg-white"><span className="text-secondary small">{lead.origin}</span></td>
                                            <td className="bg-white"><span className="text-secondary small">{lead.service}</span></td>
                                            <td className="bg-white">
                                                <span className={`badge rounded-pill px-3 py-1 fw-normal ${getStatusBadge(lead.status)}`} style={{ fontSize: "0.75rem" }}>
                                                    {lead.status}
                                                </span>
                                            </td>
                                            <td className="text-end px-4 bg-white">
                                                <button className="btn btn-sm text-secondary border-0 bg-transparent" onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>
                                                    <i className="fa-solid fa-ellipsis-vertical"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5 text-muted bg-white">
                                            No se encontraron leads con los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="card-footer bg-white border-0 py-3 px-4 text-muted small d-flex justify-content-between align-items-center">
                        <span>Mostrando {filteredLeads.length} resultados</span>
                        <span>1</span>
                    </div>
                </div>

                {/* MODAL DE CREACIÓN DE NUEVO LEAD */}
                {showCreateModal && (
                    <>
                        <div className="modal-backdrop fade show"></div>
                        <div data-bs-theme="light" className="modal fade show d-block" tabIndex="-1">
                            <div className="modal-dialog modal-dialog-centered modal-lg">
                                <div className="modal-content border-0 shadow-lg bg-white text-dark">
                                    <div className="modal-header border-bottom px-4 py-3 bg-white">
                                        <h5 className="modal-title fw-bold text-dark">Registrar Nuevo Lead</h5>
                                        <button type="button" className="btn-close shadow-none" onClick={() => setShowCreateModal(false)}></button>
                                    </div>
                                    <form onSubmit={handleCreateLead}>
                                        <div className="modal-body p-4 bg-white">
                                            <div className="row g-3">
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Nombre del cliente *</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control bg-white text-dark" 
                                                        name="name" 
                                                        value={newLead.name} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Ej. Sofía Martínez" 
                                                        required 
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Correo electrónico</label>
                                                    <input 
                                                        type="email" 
                                                        className="form-control bg-white text-dark" 
                                                        name="email" 
                                                        value={newLead.email} 
                                                        onChange={handleInputChange} 
                                                        placeholder="correo@example.com" 
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Teléfono</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control bg-white text-dark" 
                                                        name="phone" 
                                                        value={newLead.phone} 
                                                        onChange={handleInputChange} 
                                                        placeholder="+34 600 000 000" 
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Origen</label>
                                                    <select className="form-select bg-white text-dark" name="origin" value={newLead.origin} onChange={handleInputChange}>
                                                        <option value="WhatsApp">WhatsApp</option>
                                                        <option value="Instagram">Instagram</option>
                                                        <option value="Web">Web</option>
                                                        <option value="Llamada">Llamada</option>
                                                        <option value="Referido">Referido</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Servicio solicitado *</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control bg-white text-dark" 
                                                        name="service" 
                                                        value={newLead.service} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Ej. Puertas correderas" 
                                                        required 
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Zona de servicio</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control bg-white text-dark" 
                                                        name="serviceZone" 
                                                        value={newLead.serviceZone} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Ej. Sevilla Este" 
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Prioridad</label>
                                                    <select className="form-select bg-white text-dark" name="priority" value={newLead.priority} onChange={handleInputChange}>
                                                        <option value="Baja">Baja</option>
                                                        <option value="Media">Media</option>
                                                        <option value="Alta">Alta</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-semibold text-secondary">Asignado a</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control bg-white text-dark" 
                                                        name="assignedUser" 
                                                        value={newLead.assignedUser} 
                                                        onChange={handleInputChange} 
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label small fw-semibold text-secondary">Descripción general</label>
                                                    <textarea 
                                                        className="form-control bg-white text-dark" 
                                                        rows="2" 
                                                        name="description" 
                                                        value={newLead.description} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Detalles sobre lo que solicita el cliente..."
                                                    ></textarea>
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label small fw-semibold text-secondary">Notas internas</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control bg-white text-dark" 
                                                        name="internalNotes" 
                                                        value={newLead.internalNotes} 
                                                        onChange={handleInputChange} 
                                                        placeholder="Comentarios para el equipo interno..." 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="modal-footer border-top px-4 py-3 bg-light">
                                            <button type="button" className="btn btn-outline-secondary px-4" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                                            <button type="submit" className="btn btn-primary px-4 fw-semibold" style={{ backgroundColor: "#635bff", border: "none" }}>Guardar Lead</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* PANEL LATERAL DE DETALLES (Offcanvas) */}
                {selectedLead && (
                    <div className="offcanvas-backdrop fade show" onClick={() => setSelectedLead(null)}></div>
                )}
                <div data-bs-theme="light" className={`offcanvas offcanvas-end bg-white text-dark ${selectedLead ? 'show' : ''}`} tabIndex="-1" style={{ visibility: selectedLead ? 'visible' : 'hidden', width: '500px' }}>
                    {selectedLead && (
                        <div className="offcanvas-header border-bottom px-4 py-3 bg-white">
                            <div>
                                <h5 className="offcanvas-title fw-bold text-dark mb-0">{selectedLead.name}</h5>
                                <span className="text-muted small">Lead #{selectedLead.id} • Creado recientemente</span>
                            </div>
                            <button type="button" className="btn-close shadow-none" onClick={() => setSelectedLead(null)}></button>
                        </div>
                    )}
                    {selectedLead && (
                        <div className="offcanvas-body p-4 overflow-y-auto bg-white">
                            
                            {/* Acciones Rápidas */}
                            <div className="d-flex gap-2 mb-4">
                                <button className="btn btn-sm btn-primary flex-fill fw-semibold py-2" style={{ backgroundColor: "#635bff", border: "none" }}>
                                    <i className="fa-solid fa-phone me-1"></i> Contactar
                                </button>
                                <button className="btn btn-sm btn-outline-secondary flex-fill fw-semibold py-2">
                                    <i className="fa-solid fa-pen me-1"></i> Editar
                                </button>
                                <button className="btn btn-sm btn-outline-success flex-fill fw-semibold py-2">
                                    <i className="fa-solid fa-arrow-right-arrow-left me-1"></i> Convertir
                                </button>
                            </div>

                            {/* Información de Contacto */}
                            <div className="mb-4">
                                <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                    Información de Contacto
                                </h6>
                                <div className="bg-light p-3 rounded-3 small">
                                    <div className="mb-2 d-flex justify-content-between">
                                        <span className="text-secondary">Email:</span>
                                        <span className="fw-semibold text-dark">{selectedLead.email || "No especificado"}</span>
                                    </div>
                                    <div className="mb-2 d-flex justify-content-between">
                                        <span className="text-secondary">Teléfono:</span>
                                        <span className="fw-semibold text-dark">{selectedLead.phone || "No especificado"}</span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span className="text-secondary">Origen:</span>
                                        <span className="fw-semibold text-dark">{selectedLead.origin}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Información de Negocio */}
                            <div className="mb-4">
                                <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                    Información de Negocio
                                </h6>
                                <div className="bg-light p-3 rounded-3 small">
                                    <div className="mb-2 d-flex justify-content-between">
                                        <span className="text-secondary">Servicio solicitado:</span>
                                        <span className="fw-semibold text-dark">{selectedLead.service}</span>
                                    </div>
                                    <div className="mb-2 d-flex justify-content-between">
                                        <span className="text-secondary">Zona de servicio:</span>
                                        <span className="fw-semibold text-dark">{selectedLead.serviceZone || "No especificada"}</span>
                                    </div>
                                    <div className="mb-2 d-flex justify-content-between">
                                        <span className="text-secondary">Prioridad:</span>
                                        <span className="fw-semibold text-danger">{selectedLead.priority}</span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span className="text-secondary">Asignado a:</span>
                                        <span className="fw-semibold text-dark">{selectedLead.assignedUser}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Descripción y Notas */}
                            <div className="mb-4">
                                <h6 className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                    Descripción y Notas Internas
                                </h6>
                                <p className="text-secondary small mb-2">{selectedLead.description || "Sin descripción proporcionada."}</p>
                                {selectedLead.internalNotes && (
                                    <div className="p-2 bg-warning bg-opacity-10 border-start border-warning border-3 rounded small text-dark">
                                        <strong>Nota interna:</strong> {selectedLead.internalNotes}
                                    </div>
                                )}
                            </div>

                            {/* Próxima Acción */}
                            <div className="mb-4">
                                <h6 className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                    Próxima Acción
                                </h6>
                                <div className="p-3 border rounded-3 bg-white shadow-sm small">
                                    <div className="fw-bold text-dark mb-1">
                                        <i className="fa-regular fa-clock text-primary me-1"></i> {selectedLead.nextAction.date}
                                    </div>
                                    <div className="text-secondary mb-1">{selectedLead.nextAction.description}</div>
                                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Responsable: {selectedLead.nextAction.owner}</div>
                                </div>
                            </div>

                            {/* Interacciones Recientes */}
                            <div>
                                <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                    Interacciones Recientes
                                </h6>
                                <div className="vstack gap-2">
                                    {selectedLead.recentInteractions && selectedLead.recentInteractions.map((interaction, idx) => (
                                        <div key={idx} className="p-2 border-bottom small">
                                            <div className="d-flex justify-content-between text-muted" style={{ fontSize: "0.7rem" }}>
                                                <span>{interaction.type}</span>
                                                <span>{interaction.date}</span>
                                            </div>
                                            <div className="text-dark mt-1">{interaction.notes}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default Leads;