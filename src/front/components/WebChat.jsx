import { useEffect, useRef, useState } from "react";
import { webChatService } from "../services/webChatService";

export function WebChat({ token }) {
    return <ChatSession key={token} token={token} />;
}

function ChatSession({ token }) {
    const [messages, setMessages] = useState([]);
    const [content, setContent] = useState("");
    const [historyError, setHistoryError] = useState("");
    const [sendError, setSendError] = useState("");
    const [sending, setSending] = useState(false);
    const [expired, setExpired] = useState(false);
    const pendingMessage = useRef(null);
    const sendingRef = useRef(false);
    const sendController = useRef(null);

    useEffect(() => {
        return () => sendController.current?.abort();
    }, []);

    useEffect(() => {
        if (!token) return;

        const controller = new AbortController();
        let timer;
        let cursor = 0;

        async function refresh() {
            let delay = 3000;

            try {
                const data = await webChatService.listMessages({
                    token,
                    afterId: cursor,
                    signal: controller.signal,
                });

                if (controller.signal.aborted) return;

                setMessages((current) => {
                    const unique = new Map(
                        current.map((message) => [message.id, message])
                    );

                    for (const message of data.messages) {
                        unique.set(message.id, message);
                    }

                    return [...unique.values()].sort((a, b) => a.id - b.id);
                });

                cursor = data.next_after_id;
                setHistoryError("");
                delay = data.has_more ? 0 : 3000;
            } catch (error) {
                if (controller.signal.aborted) return;

                setHistoryError(error.message);

                if (error.status === 401) {
                    setExpired(true);
                    return;
                }
            }

            if (!controller.signal.aborted) {
                timer = window.setTimeout(refresh, delay);
            }
        }

        refresh();

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [token]);

    async function handleSubmit(event) {
        event.preventDefault();

        if (sendingRef.current || expired || !token) return;

        const text = content.trim();
        if (!text) return;

        sendingRef.current = true;
        setSending(true);
        setSendError("");

        try {
            if (!pendingMessage.current) {
                pendingMessage.current = {
                    externalId: crypto.randomUUID(),
                    content: text,
                };
            }

            const controller = new AbortController();
            sendController.current = controller;

            await webChatService.sendMessage({
                token,
                ...pendingMessage.current,
                signal: controller.signal,
            });

            if (controller.signal.aborted) return;

            pendingMessage.current = null;
            setContent("");
        } catch (error) {
            if (error.name === "AbortError") return;

            setSendError(error.message);
            const rejected =
                error.status >= 400 &&
                error.status < 500 &&
                error.status !== 408 &&
                error.status !== 429;

            if (rejected) {
                pendingMessage.current = null;
            }
            if (error.status === 401) {
                setExpired(true);
            }
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
    }

    if (!token) {
        return <p role="alert">A valid chat session is required.</p>;
    }

    return (
        <section className="card p-3">
            <h2 className="h5">Customer support</h2>

            {historyError && <p role="alert">{historyError}</p>}

            <div
                role="log"
                aria-label="Conversation messages"
                aria-live="polite"
                className="my-3"
                style={{ maxHeight: "50vh", overflowY: "auto" }}
            >
                {messages.length === 0 && <p>No messages yet.</p>}

                {messages.map((message) => (
                    <div key={message.id} className="border rounded p-2 mb-2">
                        <strong>
                            {message.direction === "inbound" ? "You" : "Support"}
                        </strong>
                        <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                            {message.content}
                        </p>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit}>
                <label className="form-label" htmlFor="web-chat-message">
                    Message
                </label>
                <textarea
                    id="web-chat-message"
                    className="form-control"
                    value={content}
                    onChange={(event) => {
                        setContent(event.target.value);
                        setSendError("");
                    }} maxLength={10000}
                    disabled={sending || expired || Boolean(pendingMessage.current)}
                    required
                />

                {sendError && <p role="alert">{sendError}</p>}

                <button
                    type="submit"
                    className="btn btn-primary mt-2"
                    disabled={sending || expired || !content.trim()}
                >
                    {sending ? "Sending..." : pendingMessage.current ? "Retry send" : "Send"}                </button>
            </form>
        </section>
    );
}
