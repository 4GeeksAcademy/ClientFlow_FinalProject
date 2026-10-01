const API_URL = (import.meta.env?.VITE_BACKEND_URL || "").replace(/\/$/, "");

export const subscriptionService = {
    activate: async ({ token, companyId, planId, signal }) => {
        const response = await fetch(`${API_URL}/api/subscriptions/activate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "X-Company-ID": String(companyId),
            },
            body: JSON.stringify({
                plan_id: planId,
                registration_mode: "mock_payment",
            }),
            signal,
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to activate the plan.");
        }

        return data;
    },
};
