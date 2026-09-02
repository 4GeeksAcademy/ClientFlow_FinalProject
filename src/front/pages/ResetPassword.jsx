import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";

export const ResetPassword = () => {
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
    alert("Contraseña actualizada con éxito");
    navigate("/login");
  } catch (err) {
    setLoading(false);
    setError(err.message || "Error al actualizar la contraseña.");
  }
};

  return (
    <AuthLayout>
      <div className="w-100">
        <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
          🔒
        </div>

        <h2 className="fw-bold text-dark fs-3 mb-1">Nueva contraseña</h2>
        <p className="text-muted small mb-4">Introduce y confirma tu nueva contraseña de acceso.</p>

        {error && (
          <div className="alert alert-danger py-2 small mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="vstack gap-3">
          <div>
            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Nueva contraseña</label>
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

          <div>
            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Confirmar contraseña</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">🔒</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="form-control bg-light border-start-0 shadow-none py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
            style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
          >
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
};