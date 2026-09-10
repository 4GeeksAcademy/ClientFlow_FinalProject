import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { useApp } from "../context/AppContext";

export const PlanSelection = () => {
    const { showToast } = useApp();
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/plans`);
                const data = await response.json();
                if (response.ok && data.length > 0) {
                    setPlans(data);
                    setSelectedPlanId(data[0].id);
                }
            } catch (err) {
                const staticPlans = [
                    { id: 'free', name: 'Free', description: 'Plan gratuito de prueba', price: 0, max_leads: 100, trial_days: 3 },
                    { id: 'starter', name: 'Starter', description: 'Starter plan', price: 29, max_leads: 500 },
                    { id: 'professional', name: 'Professional', description: 'Professional plan', price: 99, max_leads: 2000 },
                    { id: 'enterprise', name: 'Enterprise', description: 'Enterprise plan', price: 299, max_leads: 'Ilimitados' },
                ];
                setPlans(staticPlans);
                setSelectedPlanId(staticPlans[0].id);
            }
        };
        fetchPlans();
    }, []);

    const handleSelectPlan = async (e) => {
        e.preventDefault();
        if (!selectedPlanId) return;
        setLoading(true);

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/plan`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ planId: selectedPlanId })
            });

            if (!response.ok) throw new Error("Error al asignar el plan");

            setLoading(false);
            showToast("¡Plan activado con éxito!", "success");
            navigate("/dashboard");
        } catch (err) {
            setLoading(false);
            showToast("Plan seleccionado (Modo local)", "success");
            navigate("/dashboard");
        }
    };

    return (
        <AuthLayout>
            <div className="w-100">
                <div className="rounded-3 d-flex align-items-center justify-content-center mb-4 border border-purple-subtle" style={{ width: "3rem", height: "3rem", backgroundColor: "#f3e8ff", color: "#9333ea" }}>
                    ⭐
                </div>

                <h2 className="fw-bold text-body fs-3 mb-1">Elige tu plan</h2>
                <p className="text-muted small mb-4">Selecciona la opción que mejor se adapte a tu negocio</p>

                <form onSubmit={handleSelectPlan} className="vstack gap-3">
                    <div className="vstack gap-2">
                        {plans.map((plan) => {
                            const isSelected = selectedPlanId === plan.id;
                            const maxLeadsText = plan.max_leads === null || plan.max_leads === 'Ilimitados' ? 'Leads ilimitados' : `Hasta ${plan.max_leads} leads`;
                            
                            return (
                                <div 
                                    key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`p-3 rounded-3 border transition-all ${isSelected ? "shadow-sm bg-purple-subtle bg-opacity-10" : "border-opacity-25"}`}
                                    style={{ cursor: "pointer", borderColor: isSelected ? "#9333ea" : undefined }}
                                >
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="fw-bold text-body">{plan.name}</span>
                                        <span className="fw-semibold" style={{ color: "#9333ea" }}>€{plan.price}/mes</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mt-1">
                                        <small className="text-muted">{plan.description}</small>
                                        <small className="text-secondary fw-medium">
                                            {plan.trial_days ? `${plan.trial_days} días de prueba` : maxLeadsText}
                                        </small>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || plans.length === 0}
                        className="w-100 py-2 btn text-white fw-semibold shadow-sm mt-3"
                        style={{ backgroundColor: "#9333ea", borderColor: "#9333ea" }}
                    >
                        {loading ? "Activando..." : "Confirmar y continuar al Dashboard"}
                    </button>
                </form>
            </div>
        </AuthLayout>
    );
};