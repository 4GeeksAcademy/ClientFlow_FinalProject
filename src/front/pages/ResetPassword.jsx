import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { authService } from "../services/authService";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../context/LanguageContext";

export const ResetPassword = () => {
    const { showToast } = useApp();
    const { ui } = useLanguage();
    const [searchParams] = useSearchParams();
    const tokenFromUrl = searchParams.get("token");

    const navigate = useNavigate();
    const [confirmation, setConfirmation] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tokenFromUrl || password.length < 12 || password.length > 128 || password !== confirmation) {
            setError(ui.resetInvalid);
            return;
        }
        setError("");
        setLoading(true);

        try {
            await authService.resetPassword({ token: tokenFromUrl, password, password_confirmation: confirmation });
            setLoading(false);
            showToast(ui.resetSuccess, "success");
            navigate("/login", { state: { passwordReset: true }, replace: true });
        } catch (err) {
            setLoading(false);
            setError(err.message || ui.resetError);
        }
    };

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    🔒
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">{ui.resetTitle}</h2>
                <p className="text-muted small mb-4">{ui.resetSubtitle}</p>

                {error && (
                    <div className="alert alert-danger py-2 small mb-3">
                        {error}
                    </div>
                )}

                {!tokenFromUrl && <div className="alert alert-danger">{ui.invalidLink} <Link to="/forgot-password">{ui.requestAnotherLink}</Link>.</div>}
                <form onSubmit={handleSubmit} className="vstack gap-3">
                    <div>
                        <label className="form-label text-uppercase fw-bold text-secondary" style={{ fontSize: "0.7rem" }}>{ui.resetTitle}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="form-control bg-body text-body shadow-none py-2"
                            required
                            minLength={12}
                            maxLength={128}
                            autoComplete="new-password"
                        />
                    </div>

                    <label className="form-label">{ui.confirmPassword}
                        <input type="password" className="form-control" value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" />
                    </label>
                    <button
                        type="submit"
                        disabled={loading || !tokenFromUrl}
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-2"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        {loading ? ui.updating : ui.resetPasswordAction}
                    </button>
                </form>

                <p className="text-center text-muted small mt-4 mb-0">
                    <Link to="/login" className="fw-semibold text-decoration-none" style={{ color: "#9333ea" }}>← {ui.backToLogin}</Link>
                </p>
            </div>
        </AuthLayout>
    );
};
