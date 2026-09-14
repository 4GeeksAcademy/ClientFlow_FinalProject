import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const KPICards = () => {
    const [kpiData, setKpiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSalesModal, setShowSalesModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setTimeout(() => {
            setKpiData({
                sales: { value: 18420, change: "+8.4%", text: "este mes" },
                leads: { value: 48, change: "+12.5%", text: "este mes" },
                clients: { value: 126, change: "+6.2%", text: "este mes" },
                jobs: { value: 18, change: "+3.1%", text: "este mes" },
                appointments: { value: 24, change: "+9.8%", text: "este mes" }
            });
            setLoading(false);
        }, 300);
    }, []);

    if (loading) {
        return (
            <div className="row g-3 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div className="col" key={i}>
                        <div className="card border-0 shadow-sm p-3 bg-white rounded-3 placeholder-glow" style={{ minHeight: "100px" }}>
                            <span className="placeholder col-6 mb-2"></span>
                            <span className="placeholder col-4 fs-4"></span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="row g-3 mb-4 row-cols-1 row-cols-md-5">
                {/* 1. Ventas */}
                <div className="col">
                    <div 
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 cursor-pointer position-relative"
                        onClick={() => setShowSalesModal(true)}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-secondary small">Ventas este mes</span>
                            <span className="badge bg-light text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-euro-sign fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">€{kpiData.sales.value.toLocaleString()}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.sales.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{kpiData.sales.text}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Leads */}
                <div className="col">
                    <div 
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 cursor-pointer position-relative"
                        onClick={() => navigate("/leads")}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-secondary small">Nuevos leads</span>
                            <span className="badge bg-light text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-user-plus fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.leads.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.leads.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{kpiData.leads.text}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Clientes activos */}
                <div className="col">
                    <div 
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 cursor-pointer position-relative"
                        onClick={() => navigate("/clients")}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-secondary small">Clientes activos</span>
                            <span className="badge bg-light text-success rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-users fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.clients.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.clients.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{kpiData.clients.text}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Trabajos en curso */}
                <div className="col">
                    <div 
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 cursor-pointer position-relative"
                        onClick={() => navigate("/jobs")}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-secondary small">Trabajos en curso</span>
                            <span className="badge bg-light text-warning rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-briefcase fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.jobs.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.jobs.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{kpiData.jobs.text}</span>
                        </div>
                    </div>
                </div>

                {/* 5. Citas */}
                <div className="col">
                    <div 
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 cursor-pointer position-relative"
                        onClick={() => navigate("/agenda")}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="text-secondary small">Citas</span>
                            <span className="badge bg-light text-info rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-calendar-days fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.appointments.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.appointments.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{kpiData.appointments.text}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de resumen para ventas */}
            {showSalesModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-0">
                                <h5 className="modal-title fw-bold">Resumen de Ventas</h5>
                                <button type="button" className="btn-close" onClick={() => setShowSalesModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="text-muted small">Detalle acumulado del periodo actual:</p>
                                <ul className="list-group list-group-flush">
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>Ventas totales:</span>
                                        <strong>€18,420.00</strong>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>Trabajos completados:</span>
                                        <strong>18</strong>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>Clientes asociados:</span>
                                        <strong>126</strong>
                                    </li>
                                </ul>
                            </div>
                            <div className="modal-footer border-0">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowSalesModal(false)}>Cerrar</button>
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => { setShowSalesModal(false); navigate("/jobs"); }}>Ver reporte completo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};