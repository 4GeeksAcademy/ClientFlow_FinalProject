const API_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

async function chatRequest(
    path,
    { token, companyId, method = "GET", body, signal }
) {
    if (!token) {
        throw new Error("The chat session is required.");
    }

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    if (companyId !== undefined) {
        headers["X-Company-ID"] = String(companyId);
    }

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_URL}/api/web-chat${path}`, {
        method,
        headers,
        signal,
        cache: "no-store",
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const error = new Error(
            response.status === 401
                ? "The session has expired or is invalid."
                : "The request could not be completed."
        );
        error.status = response.status;
        throw error;
    }

    return data;
}

export const webChatService = {
    createSession: (displayName, { token, companyId, signal }) =>
        chatRequest("/sessions", {
            token,
            companyId,
            signal,
            method: "POST",
            body: { display_name: displayName },
        }),

    listMessages: ({ token, afterId = 0, signal }) =>
        chatRequest(
            `/messages?after_id=${encodeURIComponent(afterId)}`,
            { token, signal }
        ),

    sendMessage: ({ token, externalId, content, signal }) =>
        chatRequest("/messages", {
            token,
            signal,
            method: "POST",
            body: {
                external_id: externalId,
                content,
            },
        }),
};
