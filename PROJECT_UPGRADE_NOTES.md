# SigmaGPT Upgrade Notes

## Changes in this revision

- Enabled ES modules explicitly in the backend package configuration.
- Replaced the raw fetch call with the installed OpenAI SDK and added a configurable model name.
- Sent the last 20 messages in the current thread to the model, enabling follow-up questions to use conversation context.
- Added request validation and an 8,000-character message limit.
- Fixed missing early returns for not-found responses in thread retrieval/deletion paths.
- Added clearer API error responses and frontend error display.
- Made the backend wait for MongoDB before opening its HTTP port.
- Added `/health` and `.env.example`.
- Documented setup, API routes, test plan, and next academic milestones.

## Manual acceptance test plan

1. Start MongoDB and the backend; `/health` should report `status: ok` and `database: connected`.
2. Send a message in the frontend; a user message and assistant reply should appear and persist after refresh.
3. Ask a follow-up such as "Give another example"; the answer should refer to the prior question when appropriate.
4. Create a second chat and confirm it has separate history.
5. Switch back to the first chat and confirm its messages load.
6. Delete a chat and confirm it disappears from the sidebar.
7. Send an empty message or a message over 8,000 characters through the API; the backend should reject it with a 4xx status.
8. Temporarily use an invalid API key; the frontend should show an error rather than silently failing.
9. Run `npm run build` and `npm run lint` in the frontend.

## Suggested report title

**Design and Development of a Context-Aware Conversational AI Assistant Using Large Language Models**

## Next implementation milestone

Implement document question answering with retrieval-augmented generation (RAG): PDF extraction, chunking, embeddings, vector retrieval, prompt grounding, and source-page citations. Evaluate on a fixed set of course-note questions and report retrieval/answer quality and latency.

---

# Revision 2 — Reliability, security and testing (October 2026)

All changes below were implemented and verified with the automated tests and the evaluation suite in `evaluation/` (results in `evaluation/results/`).

## Backend

| Change | Problem solved | Files |
|---|---|---|
| Validated central configuration with defaults and clear start-up errors/warnings | Settings were read ad hoc; invalid values failed silently | `config.js`, `server.js`, `.env.example` |
| App factory separated from start-up | The app could not be tested in-process | `app.js`, `server.js` |
| OpenAI client with timeout, retry limit, optional temperature/max tokens and base URL | A slow model blocked a request indefinitely; settings were fixed | `utils/openai.js`, `config.js` |
| Provider errors mapped to safe statuses (504 timeout, 429 busy, 502 bad key/other) | Provider status codes such as 401 and 500 were passed straight to the browser | `utils/openai.js` |
| Context limited by message count and a character budget; never starts with an orphan reply | Twenty long messages could produce very large requests | `utils/context.js` |
| Thread-id format validation on all routes; JSON errors for malformed and oversized bodies; JSON 404 for unknown routes | Malformed input produced HTML error pages or reached the database | `utils/validation.js`, `routes/chat.js`, `middleware/errors.js` |
| In-memory per-IP rate limiter on `POST /api/chat` (Retry-After header) | No protection against request floods and runaway API costs | `middleware/rateLimit.js` |
| Security headers; `X-Powered-By` removed; body limit lowered to 100 kB | Framework fingerprinting; unnecessarily large accepted bodies | `app.js`, `middleware/errors.js` |
| `mongoose` command buffering disabled, DB guard returns 503, health returns 503 when degraded, 5 s connect timeout, graceful shutdown | When MongoDB stopped, requests hung with no response; unreachable DB took 30 s to report | `server.js`, `app.js`, `middleware/errors.js` |
| `nodemon` moved to devDependencies; Node 22 required | Development tool in production dependencies | `package.json` |
| 23 unit tests and 13 integration tests (real MongoDB + mock OpenAI) | No automated tests | `tests/` |

## Frontend

| Change | Problem solved (issue ID from the report) | Files |
|---|---|---|
| Single API client with `VITE_API_URL` and consistent error handling | Hard-coded URL (KI-2); unchecked responses (KI-4) | `src/api.js`, `.env.example` |
| Sidebar refreshes after each reply | New conversation missing from the sidebar (KI-1) | `App.jsx`, `Sidebar.jsx`, `ChatWindow.jsx` |
| Logo imported as a module | Logo missing from production build (KI-3) | `Sidebar.jsx` |
| Sidebar errors shown; loading and empty states | Errors only in the console (KI-5) | `Sidebar.jsx`, `Sidebar.css` |
| Lint error and hook warnings fixed | ESLint 1 error, 2 warnings (KI-6) | `Sidebar.jsx`, `ChatWindow.jsx`, `eslint.config.js` |
| Reply for a conversation the user has left is not shown in the wrong one | Reply appended to the wrong conversation (KI-7) | `ChatWindow.jsx` |
| Stable React keys; delete confirmation | KI-8, KI-9 | `Sidebar.jsx`, `Chat.jsx` |
| `highlight.js` declared explicitly | Indirect dependency (KI-10) | `package.json` |
| Status indicator (from `/health`), "thinking" indicator, error banner with Retry/Dismiss, character counter | Little feedback on failures | `ChatWindow.jsx`, `ChatWindow.css` |
| Non-functional menu (Settings / Upgrade plan / Log out) and "Cookie Preferences" text removed | Misleading UI elements | `ChatWindow.jsx`, `ChatWindow.css` |
| Responsive layout: sidebar becomes an overlay below 768 px | Unusable on phones (input 295 px wide at 390 px) | `*.css`, `ChatWindow.jsx`, `Sidebar.jsx` |
| Markdown: raw HTML skipped explicitly, links open with `rel="noopener noreferrer"`, copy button on code blocks | Safe rendering made explicit; usability | `Chat.jsx`, `Chat.css` |

## Not changed in this revision

Authentication, PDF question answering (RAG) and token streaming remain future work.

## AI provider configuration (October 2026)

The AI service provider is **Groq**. The backend uses the OpenAI Node.js SDK as a client for Groq's OpenAI-compatible API: `config.js` now defaults the base URL to `https://api.groq.com/openai/v1` and the model to `openai/gpt-oss-20b`. The Groq API key is read from `OPENAI_API_KEY` and the model from `OPENAI_MODEL`; `OPENAI_BASE_URL` remains an optional override, used by the automated tests to point at a local mock. All 36 backend tests and the 12 browser checks were re-run after this change and passed.

## Interface update (October 2026)

| Change | Files |
|---|---|
| Sidebar: SigmaGPT header, "+ New Chat" button, conversations grouped by date (Today / Previous 7 Days / Older) | `Sidebar.jsx`, `Sidebar.css` |
| Messages with avatars; Copy, like and dislike under each reply | `Chat.jsx`, `Chat.css` |
| Feedback stored on the message: `feedback` field and `PATCH /api/thread/:threadId/messages/:messageId/feedback`; `POST /api/chat` now returns the saved message ids | `models/Thread.js`, `routes/chat.js`, `api.js` |
| Model information menu (provider, model, endpoint, status); `/health` now reports the provider host | `ChatWindow.jsx`, `app.js` |
| Home screen lists capabilities; selecting one fills in an example question | `Chat.jsx` |
| Inline SVG icons replace the Font Awesome CDN stylesheet | `icons.jsx`, `index.html` |

Verified: 37 of 37 backend tests (new feedback integration test), lint clean, production build, and 15 of 15 browser checks (E11 to E13 cover the new features).
