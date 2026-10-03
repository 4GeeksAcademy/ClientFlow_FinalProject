const API_URL = (import.meta.env?.VITE_BACKEND_URL || "").replace(/\/$/, "");
import { readApiJson } from "./response.mjs";

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
        return readApiJson(response, "Unable to activate the plan.");
    },
};
