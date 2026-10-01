import { useEffect, useState } from "react";
import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router-dom";
import { AcceptInvitation } from "./pages/AcceptInvitation";
import { Agenda } from "./pages/Agenda";
import { Agents } from "./pages/Agents";
import { ClientDetail } from "./pages/ClientDetail";
import { Clients } from "./pages/Clients";
import { Dashboard } from "./pages/Dashboard";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Inbox } from "./pages/Inbox";
import { JobDetail } from "./pages/JobDetail";
import { Jobs } from "./pages/Jobs";
import { Knowledge } from "./pages/Knowledge";
import { Layout } from "./pages/Layout";
import { Leads } from "./pages/Leads";
import { Login } from "./pages/Login";
import { Members } from "./pages/Members";
import { Payment } from "./pages/Payment";
import { PlanSelection } from "./pages/PlanSelection";
import { Register } from "./pages/Register";
import { ResetPassword } from "./pages/ResetPassword";
import { Settings } from "./pages/Settings";
import { WebChatPage } from "./pages/WebChatPage";
import { useLanguage } from "./context/LanguageContext";

const LocalizedNotFound = () => {
    const { ui } = useLanguage();
    return <h1>{ui.notFound}</h1>;
};

const ProtectedRoute = ({ children }) => {
    const { ui } = useLanguage();
    const token = localStorage.getItem("access_token");
    const [status, setStatus] = useState("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) return;

        const controller = new AbortController();
        const apiUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

        const checkAccess = async () => {
            try {
                const headers = {
                    Authorization: `Bearer ${token}`,
                };

                const meResponse = await fetch(`${apiUrl}/api/me`, {
                    headers,
                    signal: controller.signal,
                });

                if (meResponse.status === 401) {
                    setStatus("unauthorized");
                    return;
                }

                if (!meResponse.ok) {
                    throw new Error(ui.accountLoadError);
                }

                const account = await meResponse.json();
                const company = account.companies?.[0];

                if (!company) {
                    throw new Error(ui.noCompany);
                }

                const response = await fetch(`${apiUrl}/api/auth/context`, {
                    headers: {
                        ...headers,
                        "X-Company-ID": String(company.id),
                    },
                    signal: controller.signal,
                });

                if (response.status === 401) {
                    setStatus("unauthorized");
                    return;
                }

                const data = await response.json();

                if (!response.ok) {
                    if (data.code === "subscription_required") {
                        setStatus("subscription_required");
                        return;
                    }
                    throw new Error(data.message || ui.subscriptionVerifyError);
                }

                setStatus("allowed");
            } catch (error) {
                if (controller.signal.aborted) return;
                setMessage(error.message || ui.accessVerifyError);
                setStatus("blocked");
            }
        };

        checkAccess();

        const interval = window.setInterval(checkAccess, 30000);
        window.addEventListener("focus", checkAccess);
        return () => {
            controller.abort();
            window.clearInterval(interval);
            window.removeEventListener("focus", checkAccess);
        };
    }, [token, ui.accountLoadError, ui.accessVerifyError, ui.noCompany, ui.subscriptionVerifyError]);

    if (!token || status === "unauthorized") {
        return <Navigate to="/login" replace />;
    }

    if (status === "loading") {
        return <p role="status">{ui.checkingSubscription}</p>;
    }

    if (status === "subscription_required") {
        return <Navigate to="/select-plan?reason=expired" replace />;
    }

    if (status === "blocked") {
        return (
            <div className="alert alert-warning" role="alert">
                <p>{message}</p>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.location.reload()}
                >
                    {ui.retry}
                </button>
            </div>
        );
    }

    return children;
};

export const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<Layout />} errorElement={<LocalizedNotFound />}>
            <Route path="accept-invitation" element={<AcceptInvitation />} />
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Rutas Públicas */}
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="select-plan" element={<PlanSelection />} />
            <Route path="payment" element={<Payment />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />

            {/* Ruta Protegida del Dashboard */}
            <Route
                path="dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="leads"
                element={
                    <ProtectedRoute>
                        <Leads />
                    </ProtectedRoute>
                }
            />

            {/* Ruta Protegida de Trabajos (Listado) */}
            <Route
                path="jobs"
                element={
                    <ProtectedRoute>
                        <Jobs />
                    </ProtectedRoute>
                }
            />

            {/* Ruta Protegida de Detalle de Trabajo */}
            <Route
                path="jobs/:id"
                element={
                    <ProtectedRoute>
                        <JobDetail />
                    </ProtectedRoute>
                }
            />

            {/* Ruta Protegida de Clientes (Listado) */}
            <Route
                path="clients"
                element={
                    <ProtectedRoute>
                        <Clients />
                    </ProtectedRoute>
                }
            />

            {/* Ruta Protegida de Detalle de Cliente */}
            <Route
                path="clients/:id"
                element={
                    <ProtectedRoute>
                        <ClientDetail />
                    </ProtectedRoute>
                }
            />

            {/* Ruta Protegida de la Agenda */}
            <Route
                path="agenda"
                element={
                    <ProtectedRoute>
                        <Agenda />
                    </ProtectedRoute>
                }
            />
            <Route path="agent-ai" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
            <Route path="knowledge" element={<ProtectedRoute><Knowledge /></ProtectedRoute>} />
            <Route
                path="team"
                element={
                    <ProtectedRoute>
                        <Members />
                    </ProtectedRoute>
                }
            />
            <Route
                path="settings"
                element={
                    <ProtectedRoute>
                        <Settings />
                    </ProtectedRoute>
                }
            />
            <Route
                path="conversations"
                element={
                    <ProtectedRoute>
                        <Inbox />
                    </ProtectedRoute>
                }
            />
            <Route
                path="web-chat"
                element={
                    <ProtectedRoute>
                        <WebChatPage />
                    </ProtectedRoute>
                }
            />
        </Route>
    )
);
