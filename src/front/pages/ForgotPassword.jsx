import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!email) {
    setError("Por favor ingresa tu email.");
    return;
  }
  setError("");
  setLoading(true);

  try {
    await authService.forgotPassword(email);
    setLoading(false);
    setSubmitted(true);
  } catch (err) {
    setLoading(false);
    setError(err.message || "Error al procesar la solicitud.");
  }
};

  return (
    <AuthLayout>
      <div className="w-100">
        <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
          🔑
        </div>

        <h2 className="fw-bold text-dark fs-3 mb-1">Recuperar contraseña</h2>
        <p className="text-muted small mb-4">Te enviaremos las instrucciones para restablecer tu acceso.</p>

        {error && (
          <div className="alert alert-danger py-2 small mb-3">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="p-4 rounded-3 border border-purple-subtle text-center" style={{ backgroundColor: "#f3e8ff", color: "#581c87" }}>
            <p className="fw-semibold mb-2">Correo enviado con éxito.</p>
            <p className="small text-secondary mb-3">Revisa tu bandeja de entrada y sigue el enlace para recuperar tu contraseña.</p>
            <Link to="/login" className="small fw-bold text-decoration-none" style={{ color: "#9333ea" }}>Volver al inicio de sesión</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="vstack gap-3">
            <div>
              <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Email profesional</label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
              style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
            >
              {loading ? "Enviando instrucciones..." : "Enviar instrucciones"}
            </button>
          </form>
        )}

        {!submitted && (
          <p className="text-center text-muted small mt-4 mb-0">
            ¿Recordaste tu contraseña? <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>Iniciar sesión</Link>
          </p>
        )}
      </div>
    </AuthLayout>
  );
};