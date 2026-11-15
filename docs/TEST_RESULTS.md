# SigmaGPT — Test Results (Revision 2)

All results below were produced by actually running the code. Raw outputs are in `evaluation/results/`.

## Test environment

| Item | Value |
|---|---|
| OS / hardware | Linux 6.18 (container), 1 vCPU Intel Xeon, 3.9 GB RAM |
| Node.js | 22.22.2 |
| Database | MongoDB 8.3.7 (local server) |
| Backend libraries | express 5.1.0, mongoose 8.16.1, openai 5.5.1 |
| Frontend libraries | react 19.1.0, vite 7.0.0, react-markdown 10.1.0 |
| AI model | **Mock** OpenAI-compatible server (`evaluation/mock-openai.mjs`) in place of Groq; no real model was called. The deployed provider is Groq (`https://api.groq.com/openai/v1`, model `openai/gpt-oss-20b`), reached through the OpenAI Node.js SDK. |
| Browser tests | Playwright with Chromium 141 (headless), production build via `vite preview` |
| "Baseline" | The code as received (`SigmaGPT-upgraded.zip`, revision 1) |
| "Improved" | This revision (revision 2) |

## 1. Automated backend tests (`npm test`, improved version)

36 tests: 23 unit (configuration, context selection, validation, rate limiter, error mapping) and 13 integration (real MongoDB + mock OpenAI). **Result: 36 passed, 0 failed.** The baseline had no automated tests.

## 2. Black-box API tests (same suite against both versions)

Backend settings for both runs: OPENAI_TIMEOUT_MS=2000, OPENAI_MAX_RETRIES=0, RATE_LIMIT_MAX=30 (the baseline ignores settings it does not support); mock delay for B15 = 4000 ms.

| ID | Test | Baseline | Improved |
|---|---|---|---|
| B01 | health endpoint reports database connected | Pass | Pass |
| B02 | valid chat request returns a reply and persists both messages | Pass | Pass |
| B03 | follow-up question is sent with conversation history | Pass | Pass |
| B04 | new conversation appears in the thread list with a title | Pass | Pass |
| B05 | empty body is rejected with 400 JSON | Pass | Pass |
| B06 | malformed JSON is rejected with 400 JSON | **Fail** | Pass |
| B07 | message over 8,000 characters is rejected with 413 JSON | Pass | Pass |
| B08 | request body over the size limit is rejected with 413 JSON | **Fail** | Pass |
| B09 | unknown conversation returns 404 JSON | Pass | Pass |
| B10 | malformed conversation id is rejected with 400 | **Fail** | Pass |
| B11 | deleting an unknown conversation returns 404 | Pass | Pass |
| B12 | deleting an existing conversation removes it | Pass | Pass |
| B13 | provider 500 error returns 502 JSON and saves nothing | **Fail** | Pass |
| B14 | empty provider reply returns 502 | Pass | Pass |
| B15 | provider timeout returns 504 promptly | **Fail** | Pass |
| B16 | provider rate limit returns 429 JSON | Pass | Pass |
| B17 | unknown API route returns 404 JSON | **Fail** | Pass |
| B18 | context respects a character budget for long messages | **Fail** | Pass |
| B19 | X-Powered-By header is not exposed and nosniff is set | **Fail** | Pass |
| B20 | CORS allows only the configured origin | Pass | Pass |
| B21 | chat endpoint is rate limited | **Fail** | Pass |
| | **Total passed** | **12/21** | **21/21** |

## 3. Start-up and failure scenarios

| ID | Scenario | Baseline (observed) | Improved (observed) |
|---|---|---|---|
| S1 | Start without MONGODB_URI | Pass: exit=1 after 286 ms; "MONGODB_URI is missing. Add it to Backend/.env." | Pass: exit=1 after 269 ms; "[startup] MONGODB_URI is missing. Copy Backend/.env.example to Backend/.env and set it." |
| S2 | Start with unreachable MongoDB | **Fail**: exit=1 after 30283 ms | Pass: exit=1 after 5286 ms |
| S3 | Chat with missing OPENAI_API_KEY | Pass: HTTP 503: {"error":"OPENAI_API_KEY is missing. Add it to Backend/.env."} | Pass: HTTP 503: {"error":"OPENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.","code":"AI_NOT |
| S4 | Chat with invalid OPENAI_API_KEY | **Fail**: HTTP 401: {"error":"Could not generate a reply. Check your API key, network connection, and model settings."} | Pass: HTTP 502: {"error":"The AI provider rejected the server's API key. Check OPENAI_API_KEY in Backend/.env.","cod |
| S5 | List conversations after MongoDB stops | **Fail**: HTTP no response after 20000 ms: The operation was aborted due to timeout | Pass: HTTP 503 after 3 ms: {"error":"The database is unavailable. Please try again shortly.","code":"DB_UNAVAILABLE" |
| S6 | Health check after MongoDB stops | **Fail**: HTTP 200: {"status":"ok","database":"disconnected"} | Pass: HTTP 503: {"status":"degraded","database":"disconnected","ai":"configured","model":"gpt-4o-mini","uptimeSecond |

## 4. Browser end-to-end tests (production build)

| ID | Check | Baseline | Improved |
|---|---|---|---|
| E1 | Sidebar logo loads in production build | **Fail** (naturalWidth=0) | Pass (naturalWidth=3840) |
| E2 | Message sent and reply displayed | Pass (reply shown) | Pass (reply shown) |
| E3 | New conversation appears in sidebar after first reply | **Fail** (sidebar items=[]) | Pass (sidebar items=['Explain recursion']) |
| E4 | Follow-up question sent with history (messages=4) | Pass (mock reports 4 messages) | Pass (mock reports 4 messages) |
| E5 | New chat starts empty; switching back loads earlier messages | Pass (cleared=True, earlier messages loaded=True) | Pass (cleared=True, earlier messages loaded=True) |
| E6 | Markdown rendered; raw HTML and javascript: links neutralised | Pass ({"img": 0, "code": true, "links": ["", "https://example.com"], "copy": false, "h) | Pass ({"img": 0, "code": true, "links": ["", "https://example.com"], "copy": true, "he) |
| E6b | Code blocks have a copy button | **Fail** (copy button=False) | Pass (copy button=True) |
| E7 | Provider error shown to user and prompt kept for retry | Pass (alert='Could not generate a reply. Check your API key, network connection, and m) | Pass (alert='Could not generate a reply. Please try again later. Retry Dismiss', input) |
| E8 | Conversation deleted from sidebar | Pass (items 3 -> 2) | Pass (items 3 -> 2) |
| E9 | Mobile (390 px): input uses most of the width; sidebar hidden until opened | **Fail** (input width=295px, sidebar x=0 w=185) | Pass (input width=366px, sidebar x=-312 w=312) |
| E9b | Mobile menu button opens the conversation list | **Fail** (no menu button) | Pass (sidebar x after open=0) |
| E10 | Backend offline: clear error and status | **Fail** (alert='Failed to fetch', status='(no status indicator)') | Pass (alert='Cannot reach the SigmaGPT backend at http://localhost:8080. Check that it) |
| | **Total passed** | **6/12** | **12/12** |

E10 note: the status indicator text was read immediately after the error appeared; the screenshot taken a moment later shows "Backend offline".

## 5. Static analysis and build (Frontend)

| Check | Baseline | Improved |
|---|---|---|
| `npm run lint` | 1 error (no-unused-vars), 2 warnings (react-hooks/exhaustive-deps) | 0 errors, 0 warnings |
| `npm run build` | Succeeds; logo not included in `dist/` | Succeeds; logo included (`dist/assets/blacklogo-*.png`) |
| Bundle size (JS) | 493 kB (152 kB gzip) | 496 kB (154 kB gzip) |

## 6. Backend latency with the mock model

10 prompts × 5 trials = 50 requests per row, sequential, after 5 warm-up requests. The mock replies instantly, so this measures SigmaGPT's own overhead (HTTP, validation, MongoDB read/write), **not** language-model latency.

| Measurement (ms, n = 50 each) | Baseline mean | Baseline median | Baseline p95 | Improved mean | Improved median | Improved p95 |
|---|---|---|---|---|---|---|
| New conversation | 5.9 | 4.9 | 14.4 | 5.7 | 5.1 | 13.2 |
| Follow-up in a growing conversation | 7.4 | 5.8 | 14.3 | 7.1 | 5.5 | 17.9 |

Differences are within measurement noise: the added validation, rate limiting and context selection did not measurably change latency. No claim of improved performance is made.

## 7. Not executed (needs the student's environment)

| Test | Reason |
|---|---|
| Replies, follow-up quality and response time with the real OpenAI API | No API key; the OpenAI API was not reachable from the test environment |
| Screenshots with real model replies | Same as above (existing screenshots use mock replies and show the interface only) |
| Running the Windows instructions | Tests ran on Linux |
| MongoDB Atlas | Only a local MongoDB server was used |
| Icons | The Font Awesome CDN was blocked in the test environment |

## 8. Re-run after setting Groq as the default provider

After `config.js` was changed to default to Groq (base URL `https://api.groq.com/openai/v1`, model `openai/gpt-oss-20b`), the backend suite (36 passed, 0 failed), the black-box suite (21 of 21 passed) and the failure scenarios (6 of 6 passed) were re-run, and the browser checks were re-run with `OPENAI_MODEL=openai/gpt-oss-20b` (12 of 12 passed; the status indicator shows "Online · openai/gpt-oss-20b").

## 9. Real Groq API

No test has been run against the real Groq API: no API key or network access to Groq was available in the test environment. Answer quality, follow-up behaviour with gpt-oss-20b, and real response times are therefore not reported. The planned tests (R-01 to R-07) are listed in Table 6.10 of the report.

## 10. Interface update

After the interface update, the backend suite was re-run (37 passed, 0 failed; one new integration test for message feedback) and the browser suite was re-run on both versions: revision 1 passed 6 of the 12 shared checks (unchanged), revision 2 passed all 12 shared checks and the 3 new checks (E11 date grouping, E12 stored like after reload, E13 model menu).
