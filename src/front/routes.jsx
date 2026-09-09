import React from "react";
import { Route, createBrowserRouter, createRoutesFromElements, Navigate } from "react-router-dom";
import { Layout } from "./pages/Layout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";

// Componente para proteger rutas privadas
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

export const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<Layout />} errorElement={<h1>Not found!</h1>}>
            {/* La raíz ya no carga el Login directamente, redirige al dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Rutas Públicas */}
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />

            {/* Ruta Protegida */}
            <Route 
                path="dashboard" 
                element={
                    <ProtectedRoute>
                        <div className="container mt-4">
                            <h1>Panel de Control (Dashboard)</h1>
                        </div>
                    </ProtectedRoute>
                } 
            />
        </Route>
    )
);