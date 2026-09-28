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

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        const text = await response.text();

        if (!response.ok) {
            throw new Error(
                `El servidor devolvió un error (${response.status}) al cargar los datos del cliente.`
            );
        }

        throw new Error(
            text
                ? "El servidor devolvió una respuesta no válida."
                : "El servidor devolvió una respuesta vacía."
        );
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || "No se pudo completar la operación.");
    }

    return data;
}

export const clientService = {
    create(options, body) { return request("/clients", { ...options, method: "POST", body }); },
    update(options, clientId, body) {
        return request(`/clients/${clientId}`, {
            ...options,
            method: "PATCH",
            body,
        });
    },
    list(options, page = 1, search = "", status = "all") {
        const query = new URLSearchParams({
            page,
            per_page: 20,
            search,
            status,
        });

        return request(`/clients?${query}`, options);
    },
    get(options, clientId) {
        return request(`/clients/${clientId}`, options);
    },

    getAddresses(options, clientId) {
        return request(`/clients/${clientId}/addresses`, options);
    },

    createAddress(options, clientId, body) {
        return request(`/clients/${clientId}/addresses`, {
            ...options,
            method: "POST",
            body,
        });
    },

    updateAddress(options, clientId, addressId, body) {
        return request(`/clients/${clientId}/addresses/${addressId}`, {
            ...options,
            method: "PATCH",
            body,
        });
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
