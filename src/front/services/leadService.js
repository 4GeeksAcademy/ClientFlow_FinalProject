const API_URL = (
    import.meta.env.VITE_BACKEND_URL || ""
).replace(/\/$/, "");
import { readApiJson } from "./response.mjs";

async function request(
    path,
    {
        token,
        companyId,
        signal,
        method = "GET",
        body,
    }
) {
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
        ...(body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
    });

    return readApiJson(response, "Unable to complete the lead operation.");
}

export const leadService = {
    list(
        options,
        {
            page = 1,
            search = "",
            status = "",
            source = "",
        } = {}
    ) {
        const query = new URLSearchParams({
            page: String(page),
            per_page: "20",
            search,
            status,
            source,
        });

        return request(`/leads?${query.toString()}`, options);
    },

    get(options, leadId) {
        return request(`/leads/${leadId}`, options);
    },

    create(options, body) {
        return request("/leads", {
            ...options,
            method: "POST",
            body,
        });
    },

    update(options, leadId, body) {
        return request(`/leads/${leadId}`, {
            ...options,
            method: "PATCH",
            body,
        });
    },

    convert(options, leadId) {
        return request(`/leads/${leadId}/convert`, {
            ...options,
            method: "POST",
        });
    },

    getActivities(options, leadId) {
        return request(`/leads/${leadId}/activities`, options);
    },

    getNextActions(options, leadId) {
        return request(`/leads/${leadId}/next-actions`, options);
    },

    createNextAction(options, leadId, body) {
        return request(`/leads/${leadId}/next-actions`, {
            ...options,
            method: "POST",
            body,
        });
    },

    updateNextAction(options, actionId, body) {
        return request(`/next-actions/${actionId}`, {
            ...options,
            method: "PATCH",
            body,
        });
    },
};
