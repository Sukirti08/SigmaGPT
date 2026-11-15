# SigmaGPT Revision 2 — Test Results Summary

## Scope and environment

Reviewed the extracted project’s backend, frontend, MongoDB model/configuration, and evaluation scripts. Runtime: Node.js 24.18.1, npm 12.0.2, Windows. Dependencies were installed from the supplied npm lockfiles. No source-code fixes were needed based on the checks that ran.

The project uses Groq’s OpenAI-compatible endpoint (`https://api.groq.com/openai/v1`) and model `openai/gpt-oss-20b`. Groq currently lists this model and documents the endpoint for OpenAI client compatibility: [supported models](https://console.groq.com/docs/models), [OpenAI compatibility](https://console.groq.com/docs/openai).

The local `.env` was checked without printing its contents: an API key is present and `.env` is covered by the project’s root `.gitignore`. No key value is included here.

## Results

| Test name | Procedure | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|---|
| Backend automated suite | Ran `npm test` from `Backend`, with the test URI set to the separate `sigmagpt_test` database. | Unit and integration tests pass. | 37 passed, 0 failed, 0 skipped. The 14 integration cases ran against MongoDB and the local mock provider. | Pass | Console output from the final run; test definitions in `Backend/tests/unit/` and `Backend/tests/integration/api.test.js`. |
| Chat generation and persistence | Integration test posted a chat request, checked the returned reply, then read the saved conversation from MongoDB. | Reply returned and user/assistant messages persisted. | Passed; both messages were saved and conversation title was created. | Pass | `Backend/tests/integration/api.test.js`, test “POST /api/chat returns a reply and stores both messages”. |
| Follow-up context | Integration test sent a second message and inspected the mock provider’s received prompt. | Previous user and assistant turns included with the follow-up. | Passed; system prompt and earlier conversation were present. | Pass | `Backend/tests/integration/api.test.js`, test “follow-up requests include the earlier conversation and the system prompt”. |
| Conversation listing, retrieval, deletion | Integration tests created conversations, listed them, fetched messages, and deleted one. | Correct ordering, retrieval, and deletion behavior with JSON errors for unknown IDs. | Passed. | Pass | `Backend/tests/integration/api.test.js`, list/get/delete tests. |
| Invalid API key and missing key | Integration test sent a designated invalid key to the mock provider, then removed the key and retried. | Invalid provider credential maps to safe 502; missing configuration maps to 503. | Passed: invalid key returned 502; missing key returned 503. No key value was exposed. | Pass (mock provider) | `Backend/tests/integration/api.test.js`, test “an invalid API key gives a clear 502, and a missing key gives 503”. |
| Provider rate-limit handling | Integration test sent the mock provider’s `__RATE429__` marker. | Provider 429 maps to HTTP 429 with `AI_RATE_LIMIT` and Retry-After guidance; failed exchange is not persisted. | Passed. | Pass (simulated 429) | `Backend/tests/integration/api.test.js`, test “provider errors map to safe statuses and save nothing”; mapping in `Backend/utils/openai.js`. |
| Provider timeout and application rate limiting | Integration tests triggered the mock delay and exceeded the configured per-client chat limit. | Timeout returns 504; application limit returns 429. | Passed. | Pass | `Backend/tests/integration/api.test.js`, timeout and chat-rate-limit cases. |
| Real Groq integration | Sent one short completion request through the configured OpenAI SDK client to Groq using the local key. | Groq returns a completion; record elapsed time for that request. | Request succeeded using `openai/gpt-oss-20b`; response contained 5 characters and completed in **1,158.2 ms**. This is one sample, not a latency distribution. | Pass | Direct SDK check output: provider `api.groq.com`, model ID, success, response character count, elapsed time. Key and response text were not recorded. |
| Mock-model latency (three samples) | Sent three short requests through the same SDK client to the project’s local in-process mock provider. | Mock requests return successfully and are reported separately from Groq. | All three returned HTTP 200: 90.9 ms, 9.0 ms, and 12.0 ms. Small sample only; these are mock timings, not Groq timings. | Pass (mock only) | Direct mock check output; `Backend/tests/helpers/mockOpenAI.js`. |
| Backend unit tests | Included in `npm test`; covers configuration, context selection, validation, rate limiter, and provider error mapping. | All unit tests pass. | 23 passed. | Pass | `Backend/tests/unit/*.test.js`; final `npm test` output. |
| Frontend lint | Ran `npm run lint` in `Frontend`. | ESLint exits successfully without lint errors. | Exit code 0; no lint errors reported. | Pass | `Frontend/package.json` script `lint`. |
| Frontend production build | Ran `npm run build` in `Frontend`. | Vite creates production assets and exits successfully. | Exit code 0; build completed. Vite reported an advisory: the minified JS chunk is about 502 kB, above its 500 kB threshold. | Pass, with advisory | Vite build output; generated `Frontend/dist/` in the extracted working copy. |
| Browser end-to-end evaluation | Checked the documented Python Playwright/Chromium suite. | E1-E13 UI scenarios pass against production build and mock backend. | Not run: Python Playwright is absent; installing it failed because this environment could not resolve `pypi.org`. Chrome is installed, but the suite requires the Playwright Python module. | Not run (dependency unavailable) | `evaluation/e2e_ui.py`; install attempt output: `NameResolutionError` for `pypi.org`. |
| Evaluation latency script | Ran `evaluation/latency.mjs` with its documented 10 prompts × 5 trials, 5 warm-ups, isolated MongoDB database, and in-process mock provider. | 50 new-conversation and 50 follow-up measurements reported separately. | New conversation: mean 28.9 ms, median 30.4 ms, p95 32.7 ms, min 14.6 ms, max 33.3 ms. Follow-up: mean 31.4 ms, median 32.1 ms, p95 36.6 ms, min 16.3 ms, max 38.3 ms. Mock-model/backend timings only; not Groq latency. | Pass (mock benchmark) | Actual `evaluation/latency.mjs` JSON output; database `sigmagpt_revision2_latency_20261101`. |

## Notes

The first integration-suite attempt was blocked by the execution sandbox denying local socket access (`EACCES`). After network access was enabled, the same suite passed all 37 tests. The real Groq request also succeeded after network access was enabled.

The automated invalid-key and provider-rate-limit tests use a local mock provider, by design; they verify SigmaGPT’s error handling without intentionally submitting a bad key to or exhausting quota on Groq. The one real Groq request verified successful generation and produced the recorded 1,158.2 ms sample.

No code changes were needed. The existing evaluation artifacts were treated as historical evidence and were not presented as newly run tests.

The evaluation latency script was initially left out because its mock backend/database harness had not yet been started. It has since been run successfully as documented. The Python browser suite remains unavailable because the required Playwright package could not be installed from PyPI in this environment.
