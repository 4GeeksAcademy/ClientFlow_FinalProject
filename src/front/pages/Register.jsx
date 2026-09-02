import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";

export const Register = () => {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        company: "",
        code: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.firstName || !formData.email || !formData.password) {
    setError("Por favor completa los campos obligatorios.");
    return;
  }
  setError("");
  setLoading(true);

  try {
    await authService.register(formData);
    setLoading(false);
    alert("¡Cuenta activada con éxito!");
    navigate("/login");
  } catch (err) {
    setLoading(false);
    setError(err.message || "No se pudo conectar con el servidor.");
  }
};

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    👤
                </div>

                <h2 className="fw-bold text-dark fs-3 mb-1">Registrate</h2>
                

                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="vstack gap-3">
                    <div className="row g-2">
                        <div className="col-6">
                            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Nombre</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                placeholder="Carlos"
                                className="form-control bg-light shadow-none py-2"
                            />
                        </div>
                        <div className="col-6">
                            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Apellidos</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                placeholder="Alberto"
                                className="form-control bg-light shadow-none py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Email profesional</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tu@empresa.com"
                            className="form-control bg-light shadow-none py-2"
                        />
                    </div>

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Empresa</label>
                        <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            placeholder="Nombre de la empresa"
                            className="form-control bg-light shadow-none py-2"
                        />
                    </div>

                   

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>Contraseña</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            className="form-control bg-light shadow-none py-2"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        {loading ? "Activando..." : "Activar cuenta"}
                    </button>
                </form>

                <p className="text-center text-muted small mt-4 mb-0">
                    ¿Ya tienes cuenta? <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>Iniciar sesión</Link>
                </p>
            </div>
        </AuthLayout>
    );
};