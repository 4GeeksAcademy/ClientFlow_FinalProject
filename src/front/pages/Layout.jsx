import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ScrollToTop from "../components/ScrollToTop";
import { Sidebar } from "../components/Sidebar";

export const Layout = () => {
    const location = useLocation();
    
    // Estado para saber si el sidebar móvil está abierto o cerrado
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Rutas públicas donde NO queremos que aparezca el Sidebar ni el Layout envolvente
    const hideSidebarPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/select-plan"];
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
            <div className="d-flex" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
                
                {/* Sidebar para ordenador y móvil */}
                <Sidebar 
                    isOpen={sidebarOpen} 
                    onClose={() => setSidebarOpen(false)} 
                />
                
                <div className="flex-grow-1 w-100">
                    
                    {/* Barra superior para móviles con el botón de la hamburguesa */}
                    <div 
                        className="d-md-none text-white p-3 d-flex align-items-center justify-content-between shadow-sm sticky-top" 
                        style={{ backgroundColor: "#0f172a", zIndex: 1020 }}
                    >
                        <button 
                            className="btn btn-dark text-white border-0 p-1" 
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Abrir menú"
                        >
                            <i className="fa-solid fa-bars fa-lg"></i>
                        </button>
                        <span className="fw-bold fs-6">ClientFlow</span>
                        <div style={{ width: "32px" }}></div>
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