import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ScrollToTop from "../components/ScrollToTop";
import { Sidebar } from "../components/Sidebar";

export const Layout = () => {
    const location = useLocation();
    
    // 1. NUEVO: Estado para saber si el sidebar móvil está abierto o cerrado
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Rutas públicas donde NO queremos que aparezca el Sidebar
    const hideSidebarPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/select-plan"];
const shouldHideSidebar = hideSidebarPaths.includes(location.pathname);

    return (
        <ScrollToTop>
            <div className="d-flex" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
                
                {/* 2. Pasamos las props de control al Sidebar */}
                {!shouldHideSidebar && (
                    <Sidebar 
                        isOpen={sidebarOpen} 
                        onClose={() => setSidebarOpen(false)} 
                    />
                )}
                
                <div className="flex-grow-1 w-100">
                    
                    {/* 3. NUEVO: Barra superior para móviles con el botón de la hamburguesa */}
                    {!shouldHideSidebar && (
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
                            <div style={{ width: "32px" }}></div> {/* Espaciador para centrar el título */}
                        </div>
                    )}

                    {/* Contenido dinámico de las vistas */}
                    <div className="p-3 p-md-4 main-content-area">
                        <Outlet />
                    </div>
                </div>
            </div>

            {/* 4. Estilos para el margen en ordenador (Desktop) */}
            <style>{`
                @media (min-width: 768px) {
                    .main-content-area {
                        margin-left: ${shouldHideSidebar ? "0px" : "260px"};
                    }
                }
            `}</style>
        </ScrollToTop>
    );
};

export default Layout;