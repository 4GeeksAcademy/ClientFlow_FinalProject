const API_URL = (
    import.meta.env.VITE_BACKEND_URL || ""
).replace(/\/+$/, "");

async function inboxRequest(
    path,
    { token, companyId, method = "GET", body, signal }
) {
    if (!token || !companyId) {
        throw new Error("Authentication and company selection are required.");
    }

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
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message || `Request failed (${response.status}).`
        );
    }

    return data;
}

export const inboxService = {
    listConversations: (options, page = 1) =>
        inboxRequest(`/conversations?page=${page}`, options),

    listMessages: (conversationId, options, page = 1) =>
        inboxRequest(
            `/conversations/${conversationId}/messages?page=${page}`,
            options
        ),

    createConversation: (subject, channel, options) =>
        inboxRequest("/conversations", {
            ...options,
            method: "POST",
            body: { subject, channel },
        }),

    sendMessage: (conversationId, content, options) =>
        inboxRequest(`/conversations/${conversationId}/messages`, {
            ...options,
            method: "POST",
            body: { content },
        }),

    markRead: (conversationId, messageId, options) =>
        inboxRequest(`/conversations/${conversationId}/read`, {
            ...options,
            method: "PATCH",
            body: { message_id: messageId },
        }),

    assignConversation: (conversationId, membershipId, options) =>
        inboxRequest(`/conversations/${conversationId}/assignment`, {
            ...options,
            method: "PATCH",
            body: { membership_id: membershipId },
        }),

    updateControl: (conversationId, mode, agentId, options) =>
        inboxRequest(`/conversations/${conversationId}/control`, {
            ...options,
            method: "PATCH",
            body: { mode, ai_agent_id: agentId },
        }),
};
