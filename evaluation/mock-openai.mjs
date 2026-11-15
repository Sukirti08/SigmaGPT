// Minimal mock of POST /v1/chat/completions for offline testing.
// Behaviour is selected by markers in the latest user message.
import http from "node:http";
const port = Number(process.env.MOCK_PORT || 9100);
http.createServer((req, res) => {
  let body = "";
  req.on("data", c => body += c);
  req.on("end", async () => {
    if (!req.url.endsWith("/chat/completions")) { res.writeHead(404); return res.end(); }
    if ((req.headers.authorization || "") === "Bearer bad-key") {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" } }));
    }
    const data = JSON.parse(body);
    const msgs = data.messages || [];
    const last = msgs[msgs.length - 1]?.content || "";
    if (last.includes("__DELAY__")) await new Promise(r => setTimeout(r, Number(process.env.MOCK_DELAY_MS || 4000)));
    if (last.includes("__ERROR500__")) { res.writeHead(500, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: "server error" } })); }
    if (last.includes("__RATE429__")) { res.writeHead(429, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: { message: "rate limited" } })); }
    if (last.includes("__MARKDOWN__")) {
      const md = "## Recursion\n\nA function that calls itself.\n\n```python\ndef fact(n):\n    return 1 if n == 0 else n * fact(n - 1)\n```\n\n<img src=x onerror=\"window.__xss=1\"> [unsafe link](javascript:window.__xss=2) and [safe link](https://example.com).";
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ id: "mock", object: "chat.completion", created: 0, model: data.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: md } }] }));
    }
    const content = last.includes("__EMPTY__") ? "" :
      `MOCK_REPLY model=${data.model} messages=${msgs.length} system=${msgs[0]?.role === "system"} first_user=${JSON.stringify((msgs.find(m => m.role === "user")?.content || "").slice(0, 30))}`;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "mock", object: "chat.completion", created: 0, model: data.model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
}).listen(port, () => console.log("mock openai on", port));
