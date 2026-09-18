import React from "react";
import { KPICards } from "../components/Dashboard/KPICards";
import { InteractiveCharts } from "../components/Dashboard/InteractiveCharts";

export const Dashboard = () => {
    return (
        <div className="container-fluid px-4 py-4" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
            {/* Contenedor principal que limita el ancho en pantallas grandes */}
            <div className="container px-0">
                
                {/* Header superior limpio */}
                <div className="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <span className="text-uppercase text-muted fw-bold" style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}>
                            CLIENTFLOW • CARPINTERÍA SEVILLA
                        </span>
                        <h2 className="fw-bold text-dark mb-1">Buenos días, Carlos</h2>
                        <p className="text-secondary small mb-0">Aquí tienes el resumen de tu negocio hoy.</p>
                        <div className="d-flex align-items-center mt-2">
                            <span className="badge bg-success rounded-pill p-1 me-1" style={{ width: "8px", height: "8px" }}></span>
                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>Actualizado ahora</span>
                        </div>
                    </div>
                    
                    <div>
                        <button className="btn btn-primary px-3 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" style={{ backgroundColor: "#635bff", border: "none" }}>
                            <i className="fa-solid fa-plus"></i> Crear nuevo
                        </button>
                    </div>
                </div>

                {/* 1. Tarjetas KPI del Ticket #13 */}
                <KPICards />

                {/* 2. Gráficas interactivas del Ticket #14 */}
                <InteractiveCharts />
                
            </div>
        </div>
    );
};

export default Dashboard;