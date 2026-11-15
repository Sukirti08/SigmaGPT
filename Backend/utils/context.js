// Builds the conversation context sent to the model.

export const SYSTEM_PROMPT =
    "You are SigmaGPT, a helpful AI assistant. Be clear, accurate, and admit uncertainty when needed.";

/**
 * Select the most recent messages that fit within both a message-count limit and a
 * character budget (a simple, dependency-free proxy for a token budget; roughly 4
 * characters per token for English text). The newest message is always kept.
 *
 * @param {{role: string, content: string}[]} messages chronological history, newest last
 * @param {{maxMessages: number, maxChars: number}} limits
 * @returns {{role: string, content: string}[]}
 */
export const selectContext = (messages, { maxMessages, maxChars }) => {
    const selected = [];
    let used = 0;
    for (let i = messages.length - 1; i >= 0 && selected.length < maxMessages; i--) {
        const { role, content } = messages[i];
        const size = content.length;
        if (selected.length > 0 && used + size > maxChars) break;
        selected.unshift({ role, content });
        used += size;
    }
    // A context should not start with an assistant reply whose question was dropped.
    while (selected.length > 1 && selected[0].role === "assistant") selected.shift();
    return selected;
};

export const buildPrompt = (messages, limits) => [
    { role: "system", content: SYSTEM_PROMPT },
    ...selectContext(messages, limits),
];
