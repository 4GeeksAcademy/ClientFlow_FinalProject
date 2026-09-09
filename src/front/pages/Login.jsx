import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError("Por favor completa todos los campos.");
            return;
        }
        setError("");
        setLoading(true);

        try {
            const data = await authService.login(email, password);
            setLoading(false);
            localStorage.setItem("token", data.token || "mock_token");
            showToast("¡Inicio de sesión exitoso!", "success");
            navigate("/dashboard");
        } catch (err) {
            setLoading(false);
            setError(err.message || "Credenciales inválidas.");
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