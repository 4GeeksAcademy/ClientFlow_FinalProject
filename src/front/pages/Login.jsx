import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";
import { useApp } from "../context/AppContext";

export const Login = () => {
    const { showToast } = useApp();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== "false";

const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
        setError("Introduce email y contraseña.");
        return;
    }
    setLoading(true);
    setError("");

    if (USE_MOCK_API) {
        // Simulación controlada para el PR #15
        setTimeout(() => {
            if (email === "error@clientflow.com") {
                setLoading(false);
                setError("Credenciales inválidas (Simulado)");
                return;
            }
            localStorage.setItem("access_token", "mock-access-token-xyz");
            setLoading(false);
            navigate("/dashboard");
        }, 600);
    } else {
        // Petición real al backend (Ticket #22)
        try {
            const data = await authService.login(email, password);
            localStorage.setItem("access_token", data.token);
            setLoading(false);
            navigate("/dashboard");
        } catch (err) {
            setLoading(false);
            setError(err.message || "Error al iniciar sesión");
        }
    }
};

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    🔐
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">Iniciar Sesión</h2>
                <p className="text-muted small mb-4">Ingresa a tu cuenta para continuar</p>

                {location.state?.passwordReset && <div className="alert alert-success" role="status">Contraseña actualizada. Ya puedes iniciar sesión.</div>}
                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="vstack gap-3">
                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@empresa.com"
                            className="form-control bg-body text-body shadow-none py-2"
                        />
                    </div>

                    <div>
                        <div className="d-flex justify-content-between align-items-center">
                            <label className="form-label text-uppercase fw-bold text-secondary mb-0" style={{ fontSize: "0.7rem" }}>Contraseña</label>
                            <Link to="/forgot-password" style={{ fontSize: "0.75rem", color: "#9333ea" }} className="text-decoration-none fw-semibold">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="form-control bg-body text-body shadow-none py-2 mt-1"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        {loading ? "..." : "Entrar"}
                    </button>
                </form>

                <p className="text-center text-muted small mt-4 mb-0">
                    ¿Aún no tienes cuenta? <Link to="/register" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>Regístrate</Link>
                </p>
            </div>
        </AuthLayout>
    );
};