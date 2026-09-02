import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useGlobalReducer from "../hooks/useGlobalReducer";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService"; // Importamos el servicio

export const Login = () => {
    const { dispatch } = useGlobalReducer();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError("Por favor completa todos los campos requeridos.");
            return;
        }
        setError("");
        setLoading(true);

        try {
           
            const data = await authService.login(email, password);

      localStorage.setItem("jwt_token", data.token);
      localStorage.setItem("user_data", JSON.stringify(data.user));

      dispatch({
        type: "SET_AUTH",
        payload: { token: data.token, user: data.user }
      });

      setLoading(false);
      navigate("/");
    } catch (err) {
      setLoading(false);
      setError(err.message || "Ocurrió un error.");
    }
  };

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="bg-purple-subtle text-purple rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    🔓
                </div>

                <h2 className="fw-bold text-dark fs-3 mb-1">Bienvenido de nuevo</h2>
                <p className="text-muted small mb-4">Accede a tu espacio de trabajo ClientFlow</p>

                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="vstack gap-3">
                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Email</label>
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0 text-muted">✉️</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="form-control bg-light border-start-0 shadow-none py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <label className="form-label text-uppercase fw-bold text-secondary mb-0" style={{ fontSize: "0.7rem" }}>Contraseña</label>
                            <Link to="/forgot-password" style={{ fontSize: "0.75rem", color: "#9333ea" }} className="text-decoration-none fw-medium">¿Olvidaste tu contraseña?</Link>
                        </div>
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0 text-muted">🔒</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="form-control bg-light border-start-0 shadow-none py-2"
                            />
                        </div>
                    </div>

                    <div className="form-check my-1">
                        <input type="checkbox" className="form-check-input" id="rememberMe" />
                        <label className="form-check-label text-secondary small" htmlFor="rememberMe">Recuérdame</label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                    </button>
                </form>

                <p className="text-center text-muted small mt-4 mb-0">
                    ¿Aún no tienes cuenta? <Link to="/register" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>Crear cuenta</Link>
                </p>
            </div>
        </AuthLayout>
    );
};