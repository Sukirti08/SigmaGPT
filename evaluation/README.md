# Evaluation suite

These scripts produced the baseline-versus-improved results in `results/`. They run against a real MongoDB server and a **mock** OpenAI server (`mock-openai.mjs`), so they need no API key and measure SigmaGPT's own behaviour, not the quality or speed of a real language model.

| File | Purpose |
|---|---|
| `mock-openai.mjs` | Mock `/v1/chat/completions` on port 9100. Markers in the message trigger behaviours: `__DELAY__`, `__ERROR500__`, `__RATE429__`, `__EMPTY__`, `__MARKDOWN__`; the key `bad-key` gets HTTP 401. |
| `blackbox.test.mjs` | 21 black-box API tests (B01–B21) against a running backend (`BASE_URL`). |
| `run-blackbox.sh` | Starts a backend with test settings, runs the black-box suite, stops it. |
| `scenarios.mjs` | Start-up and failure scenarios S1–S6 (missing/unreachable DB, missing/invalid key, DB stopping while running). |
| `e2e_ui.py`, `run-e2e.sh` | Browser tests E1–E10 with Playwright/Chromium on the production build; saves screenshots. |
| `latency.mjs` | 10 prompts × 5 trials, new conversation and follow-up; reports mean/median/p95. |

The shell scripts were run on Linux. On Windows, run the Node scripts directly, for example:

```powershell
node evaluation\mock-openai.mjs                     # window 1
cd Backend                                           # window 2
$env:OPENAI_BASE_URL="http://127.0.0.1:9100/v1"; $env:OPENAI_API_KEY="test-key"
$env:OPENAI_TIMEOUT_MS="2000"; $env:OPENAI_MAX_RETRIES="0"; $env:RATE_LIMIT_MAX="30"
$env:MONGODB_URI="mongodb://127.0.0.1:27017/sigmagpt_eval"; npm start
$env:BASE_URL="http://localhost:8080"; node --test evaluation\blackbox.test.mjs   # window 3, from the project root
```

Screenshots in `screenshots/` were taken with the mock model, so the replies are not real model output; they show the interface only. Icons are missing because the icon CDN was blocked in the test environment.
