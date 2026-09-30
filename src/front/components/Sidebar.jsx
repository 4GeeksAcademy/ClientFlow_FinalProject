import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [account, setAccount] = useState({ user: null, company: null });

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (!token) return undefined;

        const controller = new AbortController();
        const apiUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

        const loadAccount = async () => {
            try {
                const response = await fetch(`${apiUrl}/api/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal,
                });
                if (!response.ok) return;

                const data = await response.json();
                setAccount({
                    user: data.user || null,
                    company: data.companies?.[0] || null,
                });
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Unable to load sidebar account context.");
                }
            }
        };

        loadAccount();
        window.addEventListener("clientflow:company-updated", loadAccount);
        return () => {
            controller.abort();
            window.removeEventListener("clientflow:company-updated", loadAccount);
        };
    }, []);

    const isActive = (path) => location.pathname === path;

    const getLinkClass = (path) => {
        return `nav-link d-flex align-items-center gap-3 py-2 px-3 rounded-2 text-white small ${isActive(path) ? "bg-primary bg-opacity-50 fw-semibold text-white shadow-sm" : "text-white-50"
            }`;
    };

    // Función para manejar el cierre de sesión
    const handleLogout = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("access_token");
        const apiUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

        try {
            if (token) {
                await fetch(`${apiUrl}/api/logout`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
        } catch {
            // Local cleanup must still happen when the server is unavailable.
        } finally {
            localStorage.removeItem("access_token");
            localStorage.removeItem("jwt_token");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("user_data");
            sessionStorage.clear();
            navigate("/login", { replace: true });
        }
    };

    // Función para manejar clics en enlaces en versión móvil (cierra el drawer automáticamente)
    const handleLinkClick = () => {
        if (onClose) onClose();
    };

    const userName = [account.user?.first_name, account.user?.last_name]
        .filter(Boolean)
        .join(" ") || account.user?.email || t("nav.account");
    const companyName = account.company?.name || "ClientFlow";
    const roleKey = ["owner", "admin", "member"].includes(account.company?.role)
        ? `nav.role.${account.company.role}`
        : "nav.role.member";
    const initials = userName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "CF";

    return (
        <>
            {/* Fondo oscuro semitransparente en móvil cuando el menú está abierto */}
            {isOpen && (
                <div
                    className="modal-backdrop fade show d-md-none"
                    onClick={onClose}
                    style={{ zIndex: 1040 }}
                ></div>
            )}

            <div
                className={`d-flex flex-column flex-shrink-0 p-3 text-white vh-100 position-fixed top-0 start-0 border-end border-secondary border-opacity-10 sidebar-container ${isOpen ? "show-mobile" : ""
                    }`}
                style={{ width: "260px", backgroundColor: "#0f172a", zIndex: 1050 }}
            >
                {/* Logo y Marca con botón de cierre para móvil integrado */}
                <div className="d-flex align-items-center justify-content-between mb-3 mb-md-0 px-2">
                    <Link to="/dashboard" onClick={handleLinkClick} className="d-flex align-items-center gap-2 text-white text-decoration-none">
                        <div className="rounded-2 d-flex align-items-center justify-content-center text-white fw-bold shadow-sm" style={{ width: "36px", height: "36px", backgroundColor: "#635bff" }}>
                            <span style={{ fontSize: "1rem" }}>C</span>
                        </div>
                        <div>
                            <span className="fw-bold fs-6 d-block lh-1 text-white">ClientFlow</span>
                            <span className="text-white-50" style={{ fontSize: "0.65rem" }}>{companyName}</span>
                        </div>
                    </Link>
                    {/* Botón de cerrar visible solo en móvil */}
                    <button
                        className="btn btn-link text-white-50 d-md-none text-decoration-none p-1"
                        onClick={onClose}
                        aria-label="Cerrar menú"
                    >
                        <i className="fa-solid fa-xmark fs-5"></i>
                    </button>
                </div>

                <div className="my-3"></div>

                {/* Menú de Navegación principal */}
                <div className="overflow-y-auto pe-2" style={{ maxHeight: "calc(100vh - 160px)" }}>

                    <span className="text-uppercase text-white-50 fw-bold px-2 mb-2 d-block" style={{ fontSize: "0.6rem", letterSpacing: "0.8px" }}>
                        {t("nav.workspace")}
                    </span>

                    <ul className="nav nav-pills flex-column mb-3 gap-1">
                        <li>
                            <Link to="/dashboard" onClick={handleLinkClick} className={getLinkClass("/dashboard")}>
                                <i className="fa-solid fa-chart-pie" style={{ width: "16px" }}></i> {t("nav.dashboard")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/leads" onClick={handleLinkClick} className={getLinkClass("/leads")}>
                                <i className="fa-solid fa-user-plus" style={{ width: "16px" }}></i> {t("nav.leads")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/clients" onClick={handleLinkClick} className={getLinkClass("/clients")}>
                                <i className="fa-solid fa-users" style={{ width: "16px" }}></i> {t("nav.clients")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/jobs" onClick={handleLinkClick} className={getLinkClass("/jobs")}>
                                <i className="fa-solid fa-hammer" style={{ width: "16px" }}></i> {t("nav.jobs")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/agenda" onClick={handleLinkClick} className={getLinkClass("/agenda")}>
                                <i className="fa-solid fa-calendar-days" style={{ width: "16px" }}></i> {t("nav.agenda")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/conversations" onClick={handleLinkClick} className={`${getLinkClass("/conversations")} justify-content-between`}>
                                <span className="d-flex align-items-center gap-3">
                                    <i className="fa-solid fa-comments" style={{ width: "16px" }}></i> {t("nav.conversations")}
                                </span>
                            </Link>
                        </li>
                        <li>
                            <Link to="/knowledge" onClick={handleLinkClick} className={getLinkClass("/knowledge")}>
                                <i className="fa-solid fa-book" style={{ width: "16px" }}></i> {t("nav.knowledge")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/agent-ai" onClick={handleLinkClick} className={getLinkClass("/agent-ai")}>
                                <i className="fa-solid fa-robot" style={{ width: "16px" }}></i> {t("nav.agents")}
                            </Link>
                        </li>
                    </ul>

                    <span className="text-uppercase text-white-50 fw-bold px-2 mb-2 d-block" style={{ fontSize: "0.6rem", letterSpacing: "0.8px" }}>
                        {t("nav.administration")}
                    </span>

                    <ul className="nav nav-pills flex-column gap-1">
                        <li>
                            <Link to="/team" onClick={handleLinkClick} className={getLinkClass("/team")}>
                                <i className="fa-solid fa-user-shield" style={{ width: "16px" }}></i> {t("nav.team")}
                            </Link>
                        </li>
                        <li>
                            <Link to="/settings" onClick={handleLinkClick} className={getLinkClass("/settings")}>
                                <i className="fa-solid fa-gear" style={{ width: "16px" }}></i> {t("nav.settings")}
                            </Link>
                        </li>
                        {/*<li>
                            <Link to="/zones" onClick={handleLinkClick} className={getLinkClass("/zones")}>
                                <i className="fa-solid fa-map-location-dot" style={{ width: "16px" }}></i> Zonas de servicio
                            </Link>
                        </li>*/}
                        <li>
                            {/* Botón de Cerrar Sesión interactivo */}
                            <a
                                href="#logout"
                                onClick={(e) => {
                                    handleLinkClick();
                                    handleLogout(e);
                                }}
                                className="nav-link d-flex align-items-center gap-3 py-2 px-3 rounded-2 text-danger small hover-danger"
                                style={{ cursor: "pointer" }}
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket" style={{ width: "16px" }}></i> {t("nav.logout")}
                            </a>
                        </li>
                    </ul>
                </div>

                {/* Perfil del usuario abajo */}
                <div className="mt-auto pt-3 border-top border-secondary border-opacity-25 d-flex align-items-center justify-content-between px-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center shadow-sm" style={{ width: "34px", height: "34px", fontSize: "0.75rem", backgroundColor: "#3b3273" }}>
                            {initials}
                        </div>
                        <div style={{ lineHeight: "1.1" }}>
                            <span className="fw-bold text-white small d-block" style={{ fontSize: "0.8rem" }}>{userName}</span>
                            <span className="text-white-50" style={{ fontSize: "0.65rem" }}>{t(roleKey)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estilos CSS responsivos para ocultar y deslizar el sidebar en móviles */}
            <style>{`
                @media (max-width: 767.98px) {
                    .sidebar-container {
                        left: -260px !important;
                        transition: left 0.3s ease-in-out;
                    }
                    .sidebar-container.show-mobile {
                        left: 0 !important;
                    }
                }
            `}</style>
        </>
    );
};

export default Sidebar;
