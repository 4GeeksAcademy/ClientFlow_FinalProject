export async function readApiJson(response, fallbackMessage) {
    const contentType = response.headers?.get?.("content-type") || "application/json";
    if (!contentType.includes("application/json")) {
        await response.text();
        const error = new Error(fallbackMessage || "The server returned an invalid response.");
        error.status = response.status;
        throw error;
    }
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || data.error || fallbackMessage || "Unable to complete the operation.");
        error.status = response.status;
        error.code = data.code;
        throw error;
    }
    return data;
}
