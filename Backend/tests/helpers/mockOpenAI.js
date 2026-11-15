// In-process mock of the OpenAI Chat Completions endpoint for tests.
// The behaviour is chosen by markers in the latest message:
//   __DELAY__ (slow reply), __ERROR500__, __RATE429__, __EMPTY__
// A request with the API key "bad-key" receives HTTP 401.
import http from "node:http";

export const startMockOpenAI = ({ delayMs = 3000 } = {}) => new Promise((resolve) => {
    const requests = [];
    const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", async () => {
            if (req.headers.authorization === "Bearer bad-key") {
                res.writeHead(401, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: { message: "Incorrect API key provided" } }));
            }
            const data = JSON.parse(body);
            requests.push(data);
            const last = data.messages.at(-1)?.content ?? "";
            if (last.includes("__DELAY__")) await new Promise((r) => setTimeout(r, delayMs));
            if (last.includes("__ERROR500__")) { res.writeHead(500, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: "boom" } })); }
            if (last.includes("__RATE429__")) { res.writeHead(429, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: "slow down" } })); }
            const content = last.includes("__EMPTY__") ? "" : `MOCK_REPLY to "${last.slice(0, 40)}" (messages=${data.messages.length})`;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ id: "mock", object: "chat.completion", created: 0, model: data.model,
                choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] }));
        });
    });
    server.listen(0, "127.0.0.1", () => {
        const { port } = server.address();
        resolve({ url: `http://127.0.0.1:${port}/v1`, requests, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) });
    });
});
