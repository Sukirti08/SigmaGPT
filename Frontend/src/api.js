// Small API client: one place for the backend URL and for error handling.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

const SESSION_KEY = "sigmagpt.chatSession";

function getChatSession() {
    const current = localStorage.getItem(SESSION_KEY);
    if (/^[0-9a-f]{64}$/.test(current ?? "")) return current;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
        (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(SESSION_KEY, token);
    return token;
}

/**
 * Call the backend and return parsed JSON.
 * Throws an Error with a user-friendly message for network failures and non-2xx responses.
 */
export async function apiRequest(path, { method = "GET", body } = {}) {
    const headers = {};
    if (path.startsWith("/api/")) headers.Authorization = `Bearer ${getChatSession()}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error(`Cannot reach the SigmaGPT backend at ${API_URL}. Check that it is running.`);
    }
    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }
    if (!response.ok) {
        const error = new Error(data?.error || `Request failed with status ${response.status}.`);
        error.status = response.status;
        throw error;
    }
    return data;
}

export const listThreads = () => apiRequest("/api/thread");
export const getThread = (threadId) => apiRequest(`/api/thread/${encodeURIComponent(threadId)}`);
export const deleteThread = (threadId) => apiRequest(`/api/thread/${encodeURIComponent(threadId)}`, { method: "DELETE" });
export const sendMessage = (threadId, message) => apiRequest("/api/chat", { method: "POST", body: { threadId, message } });
export const setFeedback = (threadId, messageId, value) =>
    apiRequest(`/api/thread/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/feedback`, { method: "PATCH", body: { value } });
export const getHealth = () => apiRequest("/health").catch((error) => ({ status: "unreachable", error: error.message }));
