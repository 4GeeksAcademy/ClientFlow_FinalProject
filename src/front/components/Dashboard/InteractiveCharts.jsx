import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { chartTranslations, chartScaleData, breakdownData } from "../../../data/chartMockData";

export const InteractiveCharts = ({ currentLang = "es" }) => {
    const [scaleIndex, setScaleIndex] = useState(1); // 0: years, 1: months, 2: days, 3: hours
    const scales = ["years", "months", "days", "hours"];
    const currentScaleKey = scales[scaleIndex];
    
    const [showLeads, setShowLeads] = useState(true);
    const [showClients, setShowClients] = useState(true);
    const [selectedPoint, setSelectedPoint] = useState(null);

    const navigate = useNavigate();
    const t = chartTranslations[currentLang] || chartTranslations.es;
    const currentData = chartScaleData[currentScaleKey];

    // Control de escalas con botones - y +
    const handleScaleChange = (direction) => {
        if (direction === "zoomOut" && scaleIndex > 0) {
            setScaleIndex(scaleIndex - 1);
            setSelectedPoint(null);
        } else if (direction === "zoomIn" && scaleIndex < scales.length - 1) {
            setScaleIndex(scaleIndex + 1);
            setSelectedPoint(null);
        }
    };

    // Prevenir zoom con la rueda del ratón para permitir scroll normal de página
    const handleWheel = (e) => {
        e.stopPropagation();
    };

    const handlePointClick = (label, leadVal, clientVal) => {
        setSelectedPoint({ label, leadVal, clientVal });
    };

    const handleNavigateFilter = (type) => {
        if (type === "leads") {
            navigate(`/leads?scale=${currentScaleKey}`);
        } else if (type === "clients") {
            navigate(`/clients?scale=${currentScaleKey}`);
        }
    };

    return (
        <div className="row g-4 mb-4" onWheel={handleWheel}>
            {/* Gráfica Principal: Leads vs Clientes */}
            <div className="col-12 col-lg-8">
                <div className="card border-0 shadow-sm p-4 bg-white rounded-3 h-100">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                        <div>
                            <h5 className="fw-bold mb-1 text-dark">{t.title}</h5>
                            <p className="text-secondary small mb-0">{t.subtitle} ({currentScaleKey.toUpperCase()})</p>
                        </div>
                        
                        {/* Controles de escala (- y +) */}
                        <div className="d-flex align-items-center gap-2">
                            <div className="btn-group btn-group-sm shadow-sm" role="group" aria-label="Scale controls">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary px-2" 
                                    onClick={() => handleScaleChange("zoomOut")}
                                    disabled={scaleIndex === 0}
                                    title="Vista más amplia (-)"
                                >
                                    <i className="fa-solid fa-minus"></i>
                                </button>
                                <span className="btn btn-light disabled text-dark fw-bold px-3 border-top border-bottom">
                                    {currentScaleKey.toUpperCase()}
                                </span>
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary px-2" 
                                    onClick={() => handleScaleChange("zoomIn")}
                                    disabled={scaleIndex === scales.length - 1}
                                    title="Vista detallada (+)"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Botones para habilitar/deshabilitar series */}
                    <div className="d-flex gap-3 mb-3">
                        <button 
                            type="button"
                            className={`btn btn-sm ${showLeads ? "btn-primary" : "btn-outline-primary"}`}
                            onClick={() => setShowLeads(!showLeads)}
                        >
                            <i className="fa-solid fa-user-plus me-1"></i> {t.leadsSeries}
                        </button>
                        <button 
                            type="button"
                            className={`btn btn-sm ${showClients ? "btn-success" : "btn-outline-success"}`}
                            onClick={() => setShowClients(!showClients)}
                        >
                            <i className="fa-solid fa-users me-1"></i> {t.clientsSeries}
                        </button>
                    </div>

                    {/* Métricas destacadas del período */}
                    <div className="row g-2 mb-4 text-center">
                        <div className="col-4">
                            <div className="p-2 bg-light rounded-2">
                                <span className="d-block text-muted" style={{ fontSize: "0.7rem" }}>{t.conversion}</span>
                                <strong className="text-dark">{currentData.metrics.conversion}</strong>
                            </div>
                        </div>
                        <div className="col-4">
                            <div className="p-2 bg-light rounded-2">
                                <span className="d-block text-muted" style={{ fontSize: "0.7rem" }}>{t.bestMoment}</span>
                                <strong className="text-dark">{currentData.metrics.bestMoment}</strong>
                            </div>
                        </div>
                        <div className="col-4">
                            <div className="p-2 bg-light rounded-2">
                                <span className="d-block text-muted" style={{ fontSize: "0.7rem" }}>{t.avgDaily}</span>
                                <strong className="text-dark">{currentData.metrics.avg}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Visualizador de barras interactivo */}
                    <div className="d-flex align-items-end justify-content-between border-bottom pb-2 mb-3" style={{ height: "200px" }}>
                        {currentData.labels.map((label, index) => {
                            const leadVal = currentData.leads[index];
                            const clientVal = currentData.clients[index];
                            const maxVal = Math.max(...currentData.leads);
                            const leadHeight = (leadVal / maxVal) * 100;
                            const clientHeight = (clientVal / maxVal) * 100;

                            return (
                                <div 
                                    key={index} 
                                    className="d-flex flex-column align-items-center h-100 justify-content-end flex-grow-1 mx-1"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handlePointClick(label, leadVal, clientVal)}
                                    title={`Seleccionar ${label}`}
                                >
                                    <div className="d-flex align-items-end gap-1 w-100 justify-content-center h-100">
                                        {showLeads && (
                                            <div 
                                                className="bg-primary rounded-top transition-all" 
                                                style={{ height: `${leadHeight}%`, width: "12px", opacity: 0.85 }}
                                            ></div>
                                        )}
                                        {showClients && (
                                            <div 
                                                className="bg-success rounded-top transition-all" 
                                                style={{ height: `${clientHeight}%`, width: "12px", opacity: 0.85 }}
                                            ></div>
                                        )}
                                    </div>
                                    <span className="text-muted mt-2" style={{ fontSize: "0.7rem" }}>{label}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Panel contextual al seleccionar un punto */}
                    {selectedPoint ? (
                        <div className="alert alert-info py-2 px-3 small d-flex justify-content-between align-items-center mb-0">
                            <div>
                                <strong>Período: {selectedPoint.label}</strong> — Leads: {selectedPoint.leadVal} | Clientes: {selectedPoint.clientVal}
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={() => handleNavigateFilter("leads")}>Ver leads</button>
                                <button className="btn btn-sm btn-outline-success py-0 px-2" onClick={() => handleNavigateFilter("clients")}>Ver clientes</button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-muted text-center small">
                            Haz clic en cualquier barra para ver detalles contextuales y filtrar registros.
                        </div>
                    )}
                </div>
            </div>

            {/* Paneles laterales: Estado de trabajos y Fuentes de leads */}
            <div className="col-12 col-lg-4 d-flex flex-column gap-3">
                {/* Trabajos por estado */}
                <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                    <h6 className="fw-bold text-dark mb-3">{t.jobStatusTitle}</h6>
                    <div className="d-flex flex-column gap-2">
                        {breakdownData.jobStatus.map((item, idx) => (
                            <button 
                                key={idx} 
                                type="button"
                                className="btn btn-light d-flex justify-content-between align-items-center py-2 px-3 border-0 text-start w-100 shadow-sm"
                                onClick={() => navigate(`/jobs?status=${item.label}`)}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <span className="rounded-circle" style={{ width: "10px", height: "10px", backgroundColor: item.color }}></span>
                                    <span className="small fw-semibold text-dark">{t[item.label] || item.label}</span>
                                </div>
                                <span className="badge bg-secondary rounded-pill">{item.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fuentes de leads */}
                <div className="card border-0 shadow-sm p-3 bg-white rounded-3">
                    <h6 className="fw-bold text-dark mb-3">{t.leadSourcesTitle}</h6>
                    <div className="d-flex flex-column gap-2">
                        {breakdownData.leadSources.map((source, idx) => (
                            <button 
                                key={idx} 
                                type="button"
                                className="btn btn-light d-flex justify-content-between align-items-center py-2 px-3 border-0 text-start w-100 shadow-sm"
                                onClick={() => navigate(`/leads?source=${source.name.toLowerCase()}`)}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <span className="small fw-semibold text-dark">{source.name}</span>
                                </div>
                                <span className="badge bg-primary rounded-pill">{source.percentage}%</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};