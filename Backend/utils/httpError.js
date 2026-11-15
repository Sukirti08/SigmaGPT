/** Error carrying an HTTP status and a message that is safe to show to clients. */
export class HttpError extends Error {
    constructor(status, message, { code, retryAfter } = {}) {
        super(message);
        this.status = status;
        this.expose = true;
        if (code) this.code = code;
        if (retryAfter) this.retryAfter = retryAfter;
    }
}
