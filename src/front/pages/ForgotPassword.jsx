import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../context/LanguageContext";

export const ForgotPassword = () => {
    const { showToast } = useApp();
    const { ui } = useLanguage();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            setError(ui.emailRequired);
            return;
        }
        setError("");
        setLoading(true);

        try {
            await authService.forgotPassword(email);
            setLoading(false);
            setSubmitted(true);
            showToast(ui.recoverySent, "success");
        } catch (err) {
            setLoading(false);
            setError(err.message || ui.recoveryError);
        }
    };

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    🔄
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">{ui.forgotTitle}</h2>
                <p className="text-muted small mb-4">{ui.forgotSubtitle}</p>

                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                {submitted ? (
                    <div className="alert alert-success py-3 small text-center">
                        {ui.recoverySent} <strong>{email}</strong>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="vstack gap-3">
                        <div>
                            <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.email}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={ui.emailPlaceholder}
                                className="form-control bg-body text-body shadow-none py-2"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
                            style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                        >
                            {loading ? ui.loading : ui.sendInstructions}
                        </button>
                    </form>
                )}

                <p className="text-center text-muted small mt-4 mb-0">
                    <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>← {ui.backToLogin}</Link>
                </p>
            </div>
        </AuthLayout>
    );
};
