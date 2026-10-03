const API_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        throw new Error("The server returned an unexpected response.");
    }
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || "The settings request failed.");
    }
    return data;
}

async function account(token, signal) {
    const response = await fetch(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
    });
    return parseResponse(response);
}

async function request(path, { token, companyId, method = "GET", body, signal }) {
    const response = await fetch(`${API_URL}/api${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "X-Company-ID": String(companyId),
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return parseResponse(response);
}

export const settingsService = {
    async load(token, signal) {
        const profile = await account(token, signal);
        const company = profile.companies?.[0];
        if (!company) throw new Error("No company is available for this account.");
        const data = await request("/settings", {
            token,
            companyId: company.id,
            signal,
        });
        return { ...data, companyId: company.id };
    },
    saveCompany(options, values) {
        return request("/settings/company", { ...options, method: "PATCH", body: values });
    },
    savePreferences(options, values) {
        return request("/settings/preferences", { ...options, method: "PATCH", body: values });
    },
    saveIntegration(options, provider, values) {
        return request(`/settings/integrations/${provider}`, {
            ...options,
            method: "PUT",
            body: values,
        });
    },
    revokeOtherSessions(options) {
        return request("/settings/security/revoke-other-sessions", {
            ...options,
            method: "POST",
        });
    },
};
