import { useRef, useState } from "react";
import { WebChat } from "../components/WebChat";
import { webChatService } from "../services/webChatService";

export function WebChatPage() {
    const [displayName, setDisplayName] = useState("");
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const creating = useRef(false);

    async function handleCreate(event) {
        event.preventDefault();
        if (creating.current) return;

        creating.current = true;
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem("access_token");
            if (!token) {
                throw new Error("Sign in before creating a chat session.");
            }

            const apiUrl = (
                import.meta.env.VITE_BACKEND_URL || ""
            ).replace(/\/+$/, "");

            const response = await fetch(`${apiUrl}/api/me`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error("Unable to load your account.");
            }

            const account = await response.json();
            const company = account.companies?.[0];

            if (!company) {
                throw new Error("No company is available for this account.");
            }

            const result = await webChatService.createSession(
                displayName.trim(),
                { token, companyId: company.id }
            );

            setSession(result);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            creating.current = false;
            setLoading(false);
        }
    }

    return (
        <main className="container py-3">
            <h1 className="h3">Web chat</h1>

            {session ? (
                <>
                    <p>Conversation #{session.conversation_id}</p>
                    <WebChat token={session.token} />
                </>
            ) : (
                <form onSubmit={handleCreate} className="card p-3">
                    <label htmlFor="visitor-name" className="form-label">
                        Visitor name
                    </label>
                    <input
                        id="visitor-name"
                        className="form-control"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        maxLength={160}
                        disabled={loading}
                        required
                    />

                    {error && <p role="alert">{error}</p>}

                    <button
                        type="submit"
                        className="btn btn-primary mt-3"
                        disabled={loading || !displayName.trim()}
                    >
                        {loading ? "Creating..." : "Start chat"}
                    </button>
                </form>
            )}
        </main>
    );
}
