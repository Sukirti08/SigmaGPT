// The OpenAI Node.js SDK is used as a client for Groq's OpenAI-compatible API (base URL from config.js).
import OpenAI from "openai";
import { HttpError } from "./httpError.js";
import { buildPrompt } from "./context.js";

let cachedClient = null;
let cachedKey = "";

const getClient = (openaiConfig) => {
    if (!openaiConfig.apiKey) {
        throw new HttpError(503, "OPENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.", { code: "AI_NOT_CONFIGURED" });
    }
    const signature = `${openaiConfig.apiKey}|${openaiConfig.baseURL}|${openaiConfig.timeoutMs}|${openaiConfig.maxRetries}`;
    if (!cachedClient || cachedKey !== signature) {
        cachedClient = new OpenAI({
            apiKey: openaiConfig.apiKey,
            baseURL: openaiConfig.baseURL,
            timeout: openaiConfig.timeoutMs,
            maxRetries: openaiConfig.maxRetries,
        });
        cachedKey = signature;
    }
    return cachedClient;
};

/**
 * Convert any error from the OpenAI SDK into an HttpError with a client-safe message.
 * Provider status codes are not passed through directly: a provider 401 means *our*
 * server is misconfigured, not that the user is unauthenticated.
 */
export const toHttpError = (error) => {
    if (error instanceof HttpError) return error;
    if (error instanceof OpenAI.APIConnectionTimeoutError || error?.name === "APIConnectionTimeoutError") {
        return new HttpError(504, "The AI model took too long to respond. Please try again.", { code: "AI_TIMEOUT" });
    }
    if (error instanceof OpenAI.APIConnectionError || error?.name === "APIConnectionError") {
        return new HttpError(502, "Could not reach the AI service. Check the network connection.", { code: "AI_UNREACHABLE" });
    }
    const status = error?.status;
    if (status === 401 || status === 403) {
        return new HttpError(502, "The AI provider rejected the server's API key. Check OPENAI_API_KEY in Backend/.env.", { code: "AI_AUTH" });
    }
    if (status === 404) {
        return new HttpError(502, "The configured AI model was not found. Check OPENAI_MODEL.", { code: "AI_MODEL" });
    }
    if (status === 429) {
        return new HttpError(429, "The AI service is busy or the usage quota was reached. Please wait and try again.", { code: "AI_RATE_LIMIT", retryAfter: 30 });
    }
    if (status === 400) {
        return new HttpError(502, "The AI service rejected the request (for example, the context may be too long).", { code: "AI_BAD_REQUEST" });
    }
    return new HttpError(502, "Could not generate a reply. Please try again later.", { code: "AI_ERROR" });
};

/**
 * Generate a reply for the given conversation history.
 * @param {{role: string, content: string}[]} history chronological, newest (current question) last
 * @param {ReturnType<import("../config.js").loadConfig>} config
 */
const getOpenAIAPIResponse = async (history, config) => {
    try {
        const client = getClient(config.openai);
        const request = {
            model: config.openai.model,
            messages: buildPrompt(history, config.context),
        };
        if (config.openai.temperature !== undefined) request.temperature = config.openai.temperature;
        if (config.openai.maxOutputTokens !== undefined) request.max_tokens = config.openai.maxOutputTokens;

        const completion = await client.chat.completions.create(request);
        const reply = completion.choices?.[0]?.message?.content;
        if (!reply || !reply.trim()) {
            throw new HttpError(502, "The AI model returned an empty response.", { code: "AI_EMPTY" });
        }
        return reply;
    } catch (error) {
        throw toHttpError(error);
    }
};

export default getOpenAIAPIResponse;
