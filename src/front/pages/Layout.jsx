import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ScrollToTop from "../components/ScrollToTop";
import { Sidebar } from "../components/Sidebar";
import { WorkspacePreferences } from "../components/WorkspacePreferences";
import { useLanguage } from "../context/LanguageContext";

export const Layout = () => {
    const { ui } = useLanguage();
    const location = useLocation();

    // Estado para saber si el sidebar móvil está abierto o cerrado
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Rutas públicas donde NO queremos que aparezca el Sidebar ni el Layout envolvente
    const hideSidebarPaths = ["/accept-invitation", "/login", "/register", "/forgot-password", "/reset-password", "/select-plan"];
    const shouldHideSidebar = hideSidebarPaths.includes(location.pathname);

    // SI ES UNA RUTA PÚBLICA: Devolvemos únicamente la vista sin contenedores extra de Layout
    if (shouldHideSidebar) {
        return (
            <ScrollToTop>
                <Outlet />
            </ScrollToTop>
        );
    }

    // SI ES UNA RUTA PRIVADA: Renderizamos el panel con su Sidebar y estructura completa
    return (
        <ScrollToTop>
            <div className="d-flex workspace-shell" style={{ minHeight: "100vh" }}>
                
                {/* Sidebar para ordenador y móvil */}
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />

                <div className="flex-grow-1 w-100">
                    
                    {/* Barra superior para móviles */}
                    <div
                        className="d-md-none text-white p-3 d-flex align-items-center justify-content-between shadow-sm sticky-top mobile-workspace-bar"
                        style={{ zIndex: 1020 }}
                    >
                        <div className="d-flex align-items-center">
                            <button
                                className="btn btn-dark text-white border-0 p-1 me-2"
                                onClick={() => setSidebarOpen(true)}
                                aria-label={ui.openMenu}
                            >
                                <i className="fa-solid fa-bars fa-lg"></i>
                            </button>
                            <span className="fw-bold fs-6">ClientFlow</span>
                        </div>
                        <WorkspacePreferences compact />
                    </div>

                    <div className="d-none d-md-flex justify-content-end px-4 pt-3 workspace-toolbar">
                        <WorkspacePreferences />
                    </div>

                    {/* Contenido dinámico de las vistas privadas */}
                    <div className="p-3 p-md-4 main-content-area">
                        <Outlet />
                    </div>
                </div>
            </div>

            {/* Estilos para el margen en ordenador (Desktop) */}
            <style>{`
                @media (min-width: 768px) {
                    .main-content-area {
                        margin-left: 260px;
                    }
                }
            `}</style>
        </ScrollToTop>
    );
};

export default Layout;
