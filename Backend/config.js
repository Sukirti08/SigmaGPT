// Central, validated configuration. All values come from environment variables
// (Backend/.env in development). Secrets are never logged or sent to clients.

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const intFromEnv = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}").`);
    }
    return value;
};

const optionalNumber = (name, { min, max }) => {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${name} must be a number between ${min} and ${max} (got "${raw}").`);
    }
    return value;
};

/** Read configuration at call time so tests can change process.env. */
export const loadConfig = () => ({
    port: intFromEnv("PORT", 8080, { min: 1, max: 65535 }),
    mongoUri: process.env.MONGODB_URI || "",
    dbConnectTimeoutMs: intFromEnv("DB_CONNECT_TIMEOUT_MS", 5000, { min: 500, max: 60000 }),
    allowedOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
        .split(",").map((o) => o.trim()).filter(Boolean),
    openai: {
        apiKey: process.env.OPENAI_API_KEY || "",
        // The AI provider is Groq. The OpenAI SDK is used as a client for Groq's OpenAI-compatible API.
        model: process.env.OPENAI_MODEL || "openai/gpt-oss-20b",
        baseURL: process.env.OPENAI_BASE_URL || GROQ_BASE_URL, // override only for tests (local mock) or another compatible endpoint
        timeoutMs: intFromEnv("OPENAI_TIMEOUT_MS", 30000, { min: 1000, max: 600000 }),
        maxRetries: intFromEnv("OPENAI_MAX_RETRIES", 1, { min: 0, max: 5 }),
        temperature: optionalNumber("OPENAI_TEMPERATURE", { min: 0, max: 2 }),
        maxOutputTokens: optionalNumber("OPENAI_MAX_OUTPUT_TOKENS", { min: 1, max: 32000 }),
    },
    context: {
        maxMessages: intFromEnv("CONTEXT_MAX_MESSAGES", 20, { min: 1, max: 200 }),
        maxChars: intFromEnv("CONTEXT_MAX_CHARS", 24000, { min: 1000, max: 1000000 }),
    },
    limits: {
        maxMessageChars: intFromEnv("MAX_MESSAGE_CHARS", 8000, { min: 1, max: 100000 }),
        bodyLimit: process.env.BODY_LIMIT || "100kb",
    },
    rateLimit: {
        windowMs: intFromEnv("RATE_LIMIT_WINDOW_MS", 60000, { min: 1000, max: 3600000 }),
        max: intFromEnv("RATE_LIMIT_MAX", 20, { min: 1, max: 10000 }),
    },
});

/** Problems that should stop the server from starting. */
export const startupProblems = (config) => {
    const problems = [];
    if (!config.mongoUri) problems.push("MONGODB_URI is missing. Copy Backend/.env.example to Backend/.env and set it.");
    return problems;
};

/** Problems that allow start-up but should be shown clearly in the console. */
export const startupWarnings = (config) => {
    const warnings = [];
    const key = config.openai.apiKey;
    if (!key) warnings.push("OPENAI_API_KEY is missing: chat requests will return HTTP 503 until it is set.");
    else if (/your_openai_api_key|your_groq_api_key|your_real_api_key/i.test(key)) warnings.push("OPENAI_API_KEY still contains the placeholder value from .env.example.");
    return warnings;
};
