import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import ScrollToTop from "../components/ScrollToTop";
import { Sidebar } from "../components/Sidebar";

export const Layout = () => {
    const location = useLocation();

    // Rutas públicas donde NO queremos que aparezca el Sidebar
    const hideSidebarPaths = ["/login", "/signup", "/forgot-password", "/recovery"];
    const shouldHideSidebar = hideSidebarPaths.includes(location.pathname);

    return (
        <ScrollToTop>
            <div className={`d-flex ${shouldHideSidebar ? "" : ""}`} style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
                {/* Mostramos el Sidebar solo si NO estamos en una ruta pública */}
                {!shouldHideSidebar && <Sidebar />}
                
                {/* Si hay Sidebar dejamos margen izquierdo de 260px; si no, ocupa todo el ancho */}
                <div className="flex-grow-1" style={{ marginLeft: shouldHideSidebar ? "0px" : "260px" }}>
                    <Outlet />
                </div>
            </div>
        </ScrollToTop>
    );
};

export default Layout;