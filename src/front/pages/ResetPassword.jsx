import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";
import { useApp } from "../context/AppContext";

export const ResetPassword = () => {
    const { showToast } = useApp();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password || !confirmPassword) {
            setError("Por favor completa todos los campos.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        setError("");
        setLoading(true);

        try {
            await authService.resetPassword(password);
            setLoading(false);
            showToast("¡Contraseña restablecida con éxito!", "success");
            navigate("/login");
        } catch (err) {
            setLoading(false);
            setError(err.message || "Error al restablecer la contraseña.");
        }
    };

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    🔑
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">Nueva Contraseña</h2>
                <p className="text-muted small mb-4">Ingresa y confirma tu nueva contraseña</p>

                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="vstack gap-3">
                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Nueva Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="form-control bg-body text-body shadow-none py-2"
                        />
                    </div>

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="form-control bg-body text-body shadow-none py-2"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        {loading ? "..." : "Restablecer Contraseña"}
                    </button>
                </form>
            </div>
        </AuthLayout>
    );
};