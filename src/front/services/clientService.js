const API_URL = (
    import.meta.env.VITE_BACKEND_URL || ""
).replace(/\/$/, "");

async function request(path, { token, companyId, signal, method = "GET", body }) {
    const headers = {
        Authorization: `Bearer ${token}`,
        "X-Company-ID": String(companyId),
    };

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_URL}/api${path}`, {
        method,
        headers,
        signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || "No se pudo completar la operación.");
    }

    return data;
}

export const clientService = {
    list(options, page = 1, search = "") {
        const query = new URLSearchParams({
            page,
            per_page: 20,
            search,
        });

        return request(`/clients?${query}`, options);
    },
     get(options, clientId) {
        return request(`/clients/${clientId}`, options);
    },

    getAddresses(options, clientId) {
        return request(`/clients/${clientId}/addresses`, options);
    },

    getNextActions(options, clientId) {
        return request(`/clients/${clientId}/next-actions`, options);
    },

    getJobs(options, clientId) {
        return request(`/clients/${clientId}/jobs`, options);
    },

    getAppointments(options, clientId) {
        return request(`/clients/${clientId}/appointments`, options);
    },

    getActivities(options, clientId) {
        return request(`/clients/${clientId}/activities`, options);
    },
};