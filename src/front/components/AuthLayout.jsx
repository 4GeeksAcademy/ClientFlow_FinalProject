import React from "react";

export const AuthLayout = ({ children }) => {
    return (
        <div className="container-fluid min-vh-100 p-0 m-0">
            <div className="row g-0 min-vh-100 bg-white text-dark">
                <div className="col-lg-6 d-none d-lg-flex flex-column justify-content-between p-5 text-white position-relative overflow-hidden" style={{ backgroundColor: "#110c24" }}>
                    <div className="position-absolute rounded-circle blur-3xl pointer-events-none" style={{ top: "-6rem", right: "-6rem", width: "24rem", height: "24rem", backgroundColor: "rgba(147, 51, 234, 0.2)" }}></div>

                    <div className="d-flex align-items-center gap-2 z-1">
                        <div className="bg-purple text-white p-2 rounded fw-bold d-flex align-items-center justify-content-center shadow" style={{ width: "2.5rem", height: "2.5rem", backgroundColor: "#9333ea" }}>
                            C
                        </div>
                        <span className="fs-5 fw-semibold tracking-wide">ClientFlow</span>
                    </div>

                    <div className="z-1 max-w-md my-auto">
                        <span className="badge text-purple bg-purple-subtle px-3 py-1 rounded-pill border border-purple-subtle mb-3" style={{ color: "#c084fc", backgroundColor: "rgba(59, 7, 100, 0.6)", borderColor: "rgba(88, 28, 135, 0.4)" }}>
                            Sistema Operativo Inteligente
                        </span>
                        <h1 className="display-5 fw-bold tracking-tight lh-sm mb-3">
                            Todo tu negocio.<br />Un solo flujo.
                        </h1>
                        <p className="text-secondary small lh-base" style={{ color: "#9ca3af !important" }}>
                            Desde la primera consulta hasta el trabajo terminado: clientes, equipo, operaciones, conocimiento y agentes de IA en una sola plataforma.
                        </p>
                    </div>

                    <div className="text-muted small z-1">
                        © 2026 ClientFlow - 4Geeks Academy
                    </div>
                </div>

                <div className="col-12 col-lg-6 d-flex flex-column justify-content-between p-4 p-sm-5 overflow-y-auto" style={{ backgroundColor: "#fcfcff" }}>
                    <div className="d-flex justify-content-between align-items-center w-100 mx-auto mb-4" style={{ maxWidth: "28rem" }}>
                        <span className="small text-muted fw-medium user-select-none" role="button">
                            
                        </span>
                        <div className="d-flex align-items-center gap-2">
                            <button className="btn btn-sm btn-light border bg-white text-secondary shadow-sm">
                                ☀️
                            </button>
                            <div className="px-3 py-1 rounded border bg-white text-secondary shadow-sm small fw-medium d-flex align-items-center gap-1" role="button">
                                ES ▼
                            </div>
                        </div>
                    </div>

                    <div className="w-100 mx-auto bg-white p-4 p-sm-5 rounded-4 shadow-lg border border-opacity-10 my-auto" style={{ maxWidth: "28rem" }}>
                        {children}
                    </div>

                    <div className="h-4"></div>
                </div>
            </div>
        </div>
    );
};