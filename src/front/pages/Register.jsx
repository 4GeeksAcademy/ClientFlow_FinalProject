import { useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useApp } from "../context/AppContext";
import { authService } from "../services/authService";
import { useLanguage } from "../context/LanguageContext";

export const Register = () => {
    const { showToast } = useApp();
    const { ui } = useLanguage();
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        company: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const planId = Number(searchParams.get("plan_id"));
    const registrationMode = searchParams.get("mode") ?? "trial";

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!Number.isSafeInteger(planId) || planId <= 0) {
            setError(ui.selectPlanFirst);
            return;
        }
        if (!formData.firstName || !formData.email || !formData.password || !formData.company) {
            setError(ui.requiredFields);
            return;
        }
        setError("");
        setLoading(true);

        try {
            await authService.register({
                ...formData,
                plan_id: planId,
                registration_mode: registrationMode,
            });
            setLoading(false);
            showToast(ui.accountCreated, "success");
            navigate("/login");
        } catch (err) {
            setLoading(false);
            setError(err.message || ui.registerError);
        }
    };

    if (!Number.isSafeInteger(planId) || planId <= 0) {
        return <Navigate to="/select-plan" replace />;
    }

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    👤
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">{ui.registerTitle}</h2>
                <p className="text-muted small mb-4">{ui.registerSubtitle}</p>

                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="vstack gap-3">
                    <div className="row g-2">
                        <div className="col-6">
                            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.firstName}</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                placeholder="Carlos"
                                className="form-control bg-body text-body shadow-none py-2"
                            />
                        </div>
                        <div className="col-6">
                            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.lastName}</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                placeholder="Alberto"
                                className="form-control bg-body text-body shadow-none py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.professionalEmail}</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder={ui.emailPlaceholder}
                            className="form-control bg-body text-body shadow-none py-2"
                        />
                    </div>

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.company}</label>
                        <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            placeholder={ui.companyName}
                            className="form-control bg-body text-body shadow-none py-2"
                        />
                    </div>

                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.password}</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
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
                        {loading ? ui.processing : ui.createAccount}
                    </button>
                </form>

                <p className="text-center text-muted small mt-4 mb-0">
                    {ui.haveAccount} <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>{ui.signIn}</Link>
                </p>
            </div>
        </AuthLayout>
    );
};
