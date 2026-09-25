import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";


export const PlanSelection = () => {
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [registrationMode, setRegistrationMode] = useState("trial");

    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const controller = new AbortController();

        const fetchPlans = async () => {
            setPlansLoading(true);
            setPlansError("");

            try {
                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL || ""}/api/plans`,
                    { signal: controller.signal }
                );

                if (!response.ok) {
                    throw new Error("Unable to load plans.");
                }

                const data = await response.json();

                if (!Array.isArray(data)) {
                    throw new Error("Invalid plans response.");
                }

                setPlans(data);
                setSelectedPlanId(data[0]?.id ?? null);
            } catch {
                if (controller.signal.aborted) return;

                setPlans([]);
                setSelectedPlanId(null);
                setPlansError("Unable to load plans. Please try again.");
            } finally {
                if (!controller.signal.aborted) {
                    setPlansLoading(false);
                }
            }
        };

        fetchPlans();

        return () => controller.abort();
    }, []);

    const handleSelectPlan = (e) => {
        e.preventDefault();

        if (plansLoading || plansError || selectedPlanId === null) {
            return;
        }

        navigate(
            `/register?plan_id=${selectedPlanId}&mode=${registrationMode}`
        );
    };

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    ⭐
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">Elige tu plan</h2>
                <p className="text-muted small mb-4">Selecciona la opción que mejor se adapte a tu negocio</p>
                {plansLoading && (
                    <p role="status">Loading plans...</p>
                )}

                {plansError && (
                    <div className="alert alert-danger" role="alert">
                        {plansError}
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger ms-3"
                            onClick={() => window.location.reload()}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {!plansLoading && !plansError && plans.length === 0 && (
                    <div className="alert alert-info" role="status">
                        No plans are currently available.
                    </div>
                )}
                <form onSubmit={handleSelectPlan} className="vstack gap-3">
                    <div className="vstack gap-2">
                        {plans.map((plan) => {
                            const isSelected = selectedPlanId === plan.id;
                            const leadLimit = plan.limits?.leads;

                            const maxLeadsText =
                                leadLimit === null
                                    ? "Unlimited leads"
                                    : leadLimit === undefined
                                        ? "Lead limit not specified"
                                        : `Up to ${leadLimit} leads`;
                            return (
                                <div
                                    key={plan.id}
                                    role="radio"
                                    aria-checked={isSelected}
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === " " || event.key === "Enter") {
                                            event.preventDefault();
                                            setSelectedPlanId(plan.id);
                                        }
                                    }}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`p-3 rounded-3 border transition-all ${isSelected ? "shadow-sm bg-purple-subtle bg-opacity-10" : "border-opacity-25"}`}
                                    style={{ cursor: "pointer", borderColor: isSelected ? "#9333ea" : undefined }}
                                >
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="fw-bold text-body">{plan.name}</span>
                                        <span className="fw-semibold" style={{ color: "#9333ea" }}>€{plan.price_eur}/month</span>                                   </div>
                                    <div className="d-flex justify-content-between align-items-center mt-1">
                                        <small className="text-muted">{plan.description}</small>
                                        <small className="text-secondary fw-medium">
                                            {plan.trial_days
                                                ? `3-day trial · ${maxLeadsText}`
                                                : maxLeadsText}                                        </small>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <fieldset>
                        <legend className="fs-6">Choose how to start</legend>

                        <label className="d-block">
                            <input
                                type="radio"
                                name="registrationMode"
                                value="trial"
                                checked={registrationMode === "trial"}
                                onChange={(e) => setRegistrationMode(e.target.value)}
                                className="me-2"
                            />
                            Start a 3-day free trial
                        </label>

                        <label className="d-block mt-2">
                            <input
                                type="radio"
                                name="registrationMode"
                                value="mock_payment"
                                checked={registrationMode === "mock_payment"}
                                onChange={(e) => setRegistrationMode(e.target.value)}
                                className="me-2"
                            />
                            Simulate payment — no real charge
                        </label>
                    </fieldset>
                    <button
                        type="submit"
                        disabled={
                            plansLoading ||
                            Boolean(plansError) ||
                            selectedPlanId === null
                        }
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-3"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        Continue to registration
                    </button>
                </form>
            </div>
        </AuthLayout>
    );
};
