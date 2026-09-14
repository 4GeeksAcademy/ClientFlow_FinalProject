import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { kpiTranslations, mockKpiStates } from "../../../data/kpiMockData";

export const KPICards = ({ currentLang = "es", testState = "success" }) => {
    const [kpiData, setKpiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showSalesModal, setShowSalesModal] = useState(false);
    
    const modalCloseButtonRef = useRef(null);
    const salesCardRef = useRef(null);
    const navigate = useNavigate();
    const t = kpiTranslations[currentLang] || kpiTranslations.es;

    // Simulación de consumo de API (Contrato #12 pendiente de integración real)
    useEffect(() => {
        setLoading(true);
        setError(false);
        const timer = setTimeout(() => {
            if (testState === "error") {
                setError(true);
                setKpiData(null);
            } else if (testState === "empty") {
                setKpiData(mockKpiStates.empty);
            } else {
                setKpiData(mockKpiStates.success);
            }
            setLoading(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [testState]);

    // Gestión de foco para accesibilidad en el Modal
    useEffect(() => {
        if (showSalesModal && modalCloseButtonRef.current) {
            modalCloseButtonRef.current.focus();
        } else if (!showSalesModal && salesCardRef.current) {
            salesCardRef.current.focus();
        }
    }, [showSalesModal]);

    // Manejador de teclado para accesibilidad en modales (Escape)
    const handleKeyDownModal = (e) => {
        if (e.key === "Escape") {
            setShowSalesModal(false);
        }
    };

    // Navegación con filtros documentados (dependencias de módulos futuros)
    const handleNavigation = (destination) => {
        // Dependencia: Los módulos de destino están pendientes de implementación en tickets futuros.
        // Se documenta aquí la ruta con filtros para evitar errores 404.
        navigate(destination);
    };

    if (loading) {
        return (
            <div className="row g-3 mb-4 row-cols-1 row-cols-md-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div className="col" key={i}>
                        <div className="card border-0 shadow-sm p-3 bg-white rounded-3 placeholder-glow" style={{ minHeight: "110px" }}>
                            <span className="placeholder col-7 mb-2"></span>
                            <span className="placeholder col-5 fs-4 mb-2"></span>
                            <span className="placeholder col-4"></span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 rounded-3 shadow-sm mb-4" role="alert">
                <div><i className="fa-solid fa-triangle-exclamation me-2"></i> {t.errorMessage}</div>
                <button className="btn btn-sm btn-outline-danger" onClick={() => window.location.reload()}>Reintentar</button>
            </div>
        );
    }

    const isEmpty = testState === "empty";

    return (
        <>
            <div className="row g-3 mb-4 row-cols-1 row-cols-md-5">
                {/* 1. Ventas */}
                <div className="col">
                    <button
                        ref={salesCardRef}
                        type="button"
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 text-start w-100 text-decoration-none transition-hover position-relative"
                        onClick={() => setShowSalesModal(true)}
                        style={{ cursor: "pointer" }}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1 w-100">
                            <span className="text-secondary small">{t.sales}</span>
                            <span className="badge bg-light text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-euro-sign fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">€{kpiData.sales.value.toLocaleString()}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.sales.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t[kpiData.sales.textKey]}</span>
                        </div>
                    </button>
                </div>

                {/* 2. Leads (Filtro por período: /leads?filter=period) */}
                <div className="col">
                    <button
                        type="button"
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 text-start w-100 text-decoration-none transition-hover position-relative"
                        onClick={() => handleNavigation("/leads?filter=period")}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1 w-100">
                            <span className="text-secondary small">{t.leads}</span>
                            <span className="badge bg-light text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-user-plus fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.leads.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.leads.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t[kpiData.leads.textKey]}</span>
                        </div>
                    </button>
                </div>

                {/* 3. Clientes activos (Filtro por estado activo: /clients?status=active) */}
                <div className="col">
                    <button
                        type="button"
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 text-start w-100 text-decoration-none transition-hover position-relative"
                        onClick={() => handleNavigation("/clients?status=active")}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1 w-100">
                            <span className="text-secondary small">{t.clients}</span>
                            <span className="badge bg-light text-success rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-users fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.clients.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.clients.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t[kpiData.clients.textKey]}</span>
                        </div>
                    </button>
                </div>

                {/* 4. Trabajos en curso (Filtro por estado in_progress: /jobs?status=in_progress) */}
                <div className="col">
                    <button
                        type="button"
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 text-start w-100 text-decoration-none transition-hover position-relative"
                        onClick={() => handleNavigation("/jobs?status=in_progress")}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1 w-100">
                            <span className="text-secondary small">{t.jobs}</span>
                            <span className="badge bg-light text-warning rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-briefcase fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.jobs.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.jobs.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t[kpiData.jobs.textKey]}</span>
                        </div>
                    </button>
                </div>

                {/* 5. Citas (Filtro por período: /agenda?filter=period) */}
                <div className="col">
                    <button
                        type="button"
                        className="card border-0 shadow-sm p-3 bg-white rounded-3 h-100 text-start w-100 text-decoration-none transition-hover position-relative"
                        onClick={() => handleNavigation("/agenda?filter=period")}
                    >
                        <div className="d-flex justify-content-between align-items-center mb-1 w-100">
                            <span className="text-secondary small">{t.appointments}</span>
                            <span className="badge bg-light text-info rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: "28px", height: "28px" }}>
                                <i className="fa-solid fa-calendar-days fs-7"></i>
                            </span>
                        </div>
                        <h3 className="fw-bold mb-2 text-dark">{kpiData.appointments.value}</h3>
                        <div className="d-flex align-items-center text-success small">
                            <span className="fw-semibold me-1">{kpiData.appointments.change}</span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>{t[kpiData.appointments.textKey]}</span>
                        </div>
                    </button>
                </div>
            </div>

            {isEmpty && (
                <div className="text-center text-muted py-3 small bg-white rounded-3 mb-4 shadow-sm">
                    {t.emptyData}
                </div>
            )}

            {/* Modal de ventas accesible con gestión de teclado */}
            {showSalesModal && (
                <div 
                    className="modal show d-block" 
                    tabIndex="-1" 
                    style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                    onKeyDown={handleKeyDownModal}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-0">
                                <h5 className="modal-title fw-bold">{t.salesModalTitle}</h5>
                                <button 
                                    ref={modalCloseButtonRef}
                                    type="button" 
                                    className="btn-close" 
                                    onClick={() => setShowSalesModal(false)}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body">
                                <ul className="list-group list-group-flush">
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>{t.totalSales}</span>
                                        <strong>€{kpiData.sales.value.toLocaleString()}</strong>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>{t.completedJobs}</span>
                                        <strong>{kpiData.salesSummary.completedJobs}</strong>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>{t.activeClients}</span>
                                        <strong>{kpiData.salesSummary.associatedClients}</strong>
                                    </li>
                                    <li className="list-group-item d-flex justify-content-between px-0">
                                        <span>{t.avgPerJob}</span>
                                        <strong>€{kpiData.sales.avgJob ? kpiData.sales.avgJob.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</strong>
                                    </li>
                                </ul>
                            </div>
                            <div className="modal-footer border-0">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary btn-sm" 
                                    onClick={() => setShowSalesModal(false)}
                                >
                                    {t.close}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary btn-sm" 
                                    onClick={() => { 
                                        setShowSalesModal(false); 
                                        navigate("/reports/sales"); // Destino acordado de informe independiente
                                    }}
                                >
                                    {t.viewReport}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};