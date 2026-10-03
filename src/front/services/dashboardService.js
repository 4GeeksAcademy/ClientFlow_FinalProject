const API_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

async function request(path, { token, companyId, signal }) {
    const response = await fetch(`${API_URL}/api${path}`, {
        signal,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(companyId ? { "X-Company-ID": String(companyId) } : {}),
        },
    });
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        await response.text();
        throw new Error(
            response.ok
                ? "The server returned an invalid response."
                : `The dashboard service returned an error (${response.status}).`
        );
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || data.error || "The dashboard could not be loaded.");
    }
    return data;
}

export const getDashboardContext = (token, signal) => (
    request("/me", { token, signal })
);

export const getDashboardMetrics = (options, period = "current_month") => (
    request(`/dashboard/metrics?period=${encodeURIComponent(period)}`, options)
);

export const getDashboardCharts = (options, scale = "months") => (
    request(`/dashboard/charts?scale=${encodeURIComponent(scale)}`, options)
);
