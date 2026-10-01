import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useLanguage } from "../context/LanguageContext";
import { subscriptionService } from "../services/subscriptionService.mjs";

const normalizeCardNumber = (value) => value.replace(/\D/g, "").slice(0, 16);
const formatCardNumber = (value) => normalizeCardNumber(value).replace(/(.{4})/g, "$1 ").trim();

export const Payment = () => {
    const { ui } = useLanguage();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = localStorage.getItem("access_token");
    const planId = Number(searchParams.get("plan_id"));
    const [plan, setPlan] = useState(null);
    const [companyId, setCompanyId] = useState(null);
    const [companyRole, setCompanyRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        cardholder: "",
        cardNumber: "",
        expiry: "",
        securityCode: "",
    });

    const validPlanId = Number.isSafeInteger(planId) && planId > 0;
    const canActivate = ["owner", "admin"].includes(companyRole);
    const cardDigits = useMemo(() => normalizeCardNumber(form.cardNumber), [form.cardNumber]);

    useEffect(() => {
        if (!token || !validPlanId) {
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        const apiUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

        Promise.all([
            fetch(`${apiUrl}/api/me`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            }),
            fetch(`${apiUrl}/api/plans`, { signal: controller.signal }),
        ])
            .then(async ([accountResponse, plansResponse]) => {
                if (accountResponse.status === 401) {
                    localStorage.removeItem("access_token");
                    navigate("/login", { replace: true });
                    return;
                }
                if (!accountResponse.ok) throw new Error(ui.accountLoadError);
                if (!plansResponse.ok) throw new Error(ui.plansError);

                const [account, plans] = await Promise.all([
                    accountResponse.json(),
                    plansResponse.json(),
                ]);
                const company = account.companies?.[0];
                if (!company) throw new Error(ui.noCompany);
                const selectedPlan = Array.isArray(plans)
                    ? plans.find((candidate) => candidate.id === planId)
                    : null;
                if (!selectedPlan) throw new Error(ui.planNotFound);

                setCompanyId(company.id);
                setCompanyRole(company.role);
                setPlan(selectedPlan);
            })
            .catch((requestError) => {
                if (!controller.signal.aborted) {
                    setError(requestError.message || ui.connectionError);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [navigate, planId, token, ui.accountLoadError, ui.connectionError, ui.noCompany, ui.planNotFound, ui.plansError, validPlanId]);

    const updateField = (event) => {
        const { name, value } = event.target;
        let nextValue = value;
        if (name === "cardNumber") nextValue = formatCardNumber(value);
        if (name === "securityCode") nextValue = value.replace(/\D/g, "").slice(0, 4);
        if (name === "expiry") {
            const digits = value.replace(/\D/g, "").slice(0, 4);
            nextValue = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
        }
        setForm((current) => ({ ...current, [name]: nextValue }));
    };

    const paymentDetailsAreValid = () => {
        const [month, year] = form.expiry.split("/").map(Number);
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear() % 100;
        const expiryIsCurrentOrFuture =
            year > currentYear || (year === currentYear && month >= currentMonth);
        return (
            form.cardholder.trim().length >= 2 &&
            cardDigits.length === 16 &&
            month >= 1 &&
            month <= 12 &&
            Number.isInteger(year) &&
            expiryIsCurrentOrFuture &&
            form.securityCode.length >= 3
        );
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!plan || !companyId || !canActivate || !paymentDetailsAreValid()) {
            setError(canActivate ? ui.invalidPaymentDetails : ui.planAdminRequired);
            return;
        }

        setError("");
        setSubmitting(true);
        try {
            await subscriptionService.activate({
                token,
                companyId,
                planId: plan.id,
            });
            navigate("/dashboard", { replace: true });
        } catch (activationError) {
            setError(activationError.message || ui.planActivationError);
        } finally {
            setSubmitting(false);
        }
    };

    if (!token) return <Navigate to="/login" replace />;
    if (!validPlanId) return <Navigate to="/select-plan?reason=expired" replace />;

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    💳
                </div>
                <h2 className="fw-bold text-body fs-3 mb-1">{ui.paymentTitle}</h2>
                <p className="text-muted small mb-4">{ui.paymentSubtitle}</p>

                {loading && <p role="status">{ui.loading}</p>}
                {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
                {!loading && !canActivate && companyRole && (
                    <div className="alert alert-info py-2 small" role="status">{ui.planAdminRequired}</div>
                )}

                {plan && (
                    <form onSubmit={handleSubmit} className="vstack gap-3" autoComplete="off">
                        <section className="rounded-3 border p-3 bg-body-tertiary">
                            <p className="text-uppercase fw-bold text-secondary small mb-2">{ui.orderSummary}</p>
                            <div className="d-flex justify-content-between gap-3">
                                <div>
                                    <div className="fw-semibold text-body">{plan.name}</div>
                                    <small className="text-muted">{ui.billedMonthly}</small>
                                </div>
                                <div className="fw-bold" style={{ color: "#9333ea" }}>
                                    €{plan.price_eur}{ui.perMonth}
                                </div>
                            </div>
                        </section>

                        <fieldset disabled={submitting || !canActivate} className="vstack gap-3">
                            <legend className="fs-6 fw-semibold mb-0">{ui.paymentDetails}</legend>
                            <div>
                                <label htmlFor="cardholder" className="form-label small fw-semibold">{ui.cardholderName}</label>
                                <input id="cardholder" name="cardholder" value={form.cardholder} onChange={updateField} autoComplete="off" className="form-control bg-body text-body" required />
                            </div>
                            <div>
                                <label htmlFor="cardNumber" className="form-label small fw-semibold">{ui.cardNumber}</label>
                                <input id="cardNumber" name="cardNumber" value={form.cardNumber} onChange={updateField} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" className="form-control bg-body text-body" required />
                            </div>
                            <div className="row g-2">
                                <div className="col-7">
                                    <label htmlFor="expiry" className="form-label small fw-semibold">{ui.expiryDate}</label>
                                    <input id="expiry" name="expiry" value={form.expiry} onChange={updateField} inputMode="numeric" autoComplete="off" placeholder="MM/YY" className="form-control bg-body text-body" required />
                                </div>
                                <div className="col-5">
                                    <label htmlFor="securityCode" className="form-label small fw-semibold">{ui.securityCode}</label>
                                    <input id="securityCode" name="securityCode" value={form.securityCode} onChange={updateField} inputMode="numeric" autoComplete="off" placeholder="123" className="form-control bg-body text-body" required />
                                </div>
                            </div>
                        </fieldset>

                        <div className="alert alert-info py-2 small mb-0" role="note">{ui.simulatedPaymentNotice}</div>
                        <div className="d-flex gap-2">
                            <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={() => navigate("/select-plan?reason=expired")} disabled={submitting}>
                                {ui.changePlan}
                            </button>
                            <button type="submit" className="btn text-white fw-semibold flex-grow-1" style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }} disabled={loading || submitting || !canActivate}>
                                {submitting ? ui.confirmingPayment : ui.confirmPayment}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </AuthLayout>
    );
};
