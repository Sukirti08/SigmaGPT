# SigmaGPT Windows test results

**Run time:** 2026-11-01 23:43 Asia/Kolkata  |  **Project:** Revision 2

## Environment

| Item | Observed |
| --- | --- |
| OS | Windows 11, build 26300 (10.0.26300) |
| CPU | 11th Gen Intel Core i5-1155G7 @ 2.50 GHz |
| RAM | 7.8 GiB |
| Node.js / npm | v24.18.1 / 12.0.2 |
| MongoDB Server | 8.0.12; 127.0.0.1:27017 ping returned 1 |
| Python | 3.14.6 |
| Browser | Chrome for Testing / Playwright Chromium 156.0.8078.4; installed Chrome 156.0.8078.76 |
| Playwright | Python package 1.64.1; Chromium installed into workspace cache |
| Groq key | Present in local Backend/.env; value never read into logs or report |

## Automated tests (mock model)

| Test ID | Procedure | Expected | Actual | Status | Evidence file |
| --- | --- | --- | --- | --- | --- |
| A1 | Backend `npm test` with isolated test URI | 37 tests pass, no failures/skips | 37 passed; 0 failed; 0 skipped (13 API/integration + 24 unit) | Pass | raw/backend-npm-test-locked.txt |
| A2 | Frontend `npm run lint` (locked test copy) | Lint clean | Exit 0; no lint diagnostics | Pass | raw/frontend-lint-locked.txt |
| A3 | Frontend production build (locked test copy) | Build succeeds; report bundle and warnings | Exit 0; JS bundle 502.09 kB; >500 kB chunk warning | Pass with warning | raw/frontend-build-locked.txt |

### Dependency-install notes

- Ran `npm install --no-audit --no-fund --package-lock=false` in the original Backend and Frontend folders as requested. Backend completed; Frontend exited successfully but logged EPERM cleanup/esbuild install-script messages because the original frontend Vite process had files open.
- Restored Backend locked dependencies with `npm ci`; Frontend `npm ci` in the original folder failed with EPERM on the locked esbuild executable. Re-ran both `npm ci` commands in a clean, key-free test copy; both completed, then lint/build passed with the locked versions. The original Frontend could not be restored while its process held files. No package manifests or lockfiles were changed.
- No application source or configuration changes were made. Tests ran in a clean copy for locked frontend/backend dependencies; source `.env` was not edited.

## Black-box API (mock model)

| Test ID | Procedure | Expected | Actual | Status | Evidence file |
| --- | --- | --- | --- | --- | --- |
| B01-B21 | `node --test evaluation/blackbox.test.mjs` against mock-backed API | All 21 black-box cases pass | 21 passed; 0 failed; 0 skipped | Pass | raw/blackbox-B01-B21-final.txt; raw/blackbox-B01-B21.json |

B01–B21 passed individually. Detailed names and observed timings are in the JSON and raw console output.

## Failure scenarios (mock model)

| Test ID | Procedure | Expected | Actual | Status | Evidence file |
| --- | --- | --- | --- | --- | --- |
| S1 | Start without MONGODB_URI | Start without MONGODB_URI | exit=1 after 2628 ms; "[startup] MONGODB_URI is missing. Copy Backend/.env.example to Backend/.env and set it." | Pass | raw/scenarios-S1-S6.json |
| S2 | Start with unreachable MongoDB | Start with unreachable MongoDB | exit=1 after 7294 ms | Pass | raw/scenarios-S1-S6.json |
| S3 | Chat with missing OPENAI_API_KEY | Chat with missing OPENAI_API_KEY | HTTP 503: {"error":"OPENAI_API_KEY is missing. Add it to Backend/.env and restart the backend.","code":"AI_NOT_CONFIGURED"} | Pass | raw/scenarios-S1-S6.json |
| S4 | Chat with invalid OPENAI_API_KEY | Chat with invalid OPENAI_API_KEY | HTTP 502: {"error":"The AI provider rejected the server's API key. Check OPENAI_API_KEY in Backend/.env.","code":"AI_AUTH"} | Pass | raw/scenarios-S1-S6.json |
| S5 | Manual DB outage probe | Expected scenario behavior | HTTP 503 in 74.2 ms: {"error":"The database is unavailable. Please try again shortly.","code":"DB_UNAVAILABLE"} | Pass | raw/scenarios-S1-S6.json |
| S6 | Manual DB outage probe | Expected scenario behavior | HTTP 503 in 6.1 ms: {"status":"degraded","database":"disconnected","ai":"configured","model":"openai/gpt-oss-20b","provider":"127.0.0.1:9100","uptimeSeconds":65} | Pass | raw/scenarios-S1-S6.json |

The supplied scenario runner uses `mongod --fork`, unsupported on this Windows MongoDB build. S1–S4 came from the supplied runner; S5/S6 were completed with a foreground Windows `mongod` on a temporary test data directory and a separate test database. The failed first invocation is preserved as raw evidence.

## Browser E2E (mock model)

| Test ID | Procedure | Expected | Actual | Status | Evidence file |
| --- | --- | --- | --- | --- | --- |
| E1 | Sidebar logo loads in production build | Expected UI behavior/check to pass | naturalWidth=3840 | Pass | raw/browser-E1-E13.json |
| E2 | Message sent and reply displayed | Expected UI behavior/check to pass | reply shown | Pass | raw/browser-E1-E13.json |
| E3 | New conversation appears in sidebar after first reply | Expected UI behavior/check to pass | sidebar items=['Explain recursion', '__MARKDOWN__', 'Explain recursion'] | Pass | raw/browser-E1-E13.json |
| E4 | Follow-up question sent with history (messages=4) | Expected UI behavior/check to pass | mock reports 4 messages | Pass | raw/browser-E1-E13.json |
| E5 | New chat starts empty; switching back loads earlier messages | Expected UI behavior/check to pass | cleared=True, earlier messages loaded=True | Pass | raw/browser-E1-E13.json |
| E6 | Markdown rendered; raw HTML and javascript: links neutralised | Expected UI behavior/check to pass | {"img": 0, "code": true, "links": ["", "https://example.com"], "copy": true, "heading": true, "xss": null} | Pass | raw/browser-E1-E13.json |
| E6b | Code blocks have a copy button | Expected UI behavior/check to pass | copy button=True | Pass | raw/browser-E1-E13.json |
| E7 | Provider error shown to user and prompt kept for retry | Expected UI behavior/check to pass | alert='Could not generate a reply. Please try again later.<br>Retry<br>Dismiss', input='__ERROR500__' | Pass | raw/browser-E1-E13.json |
| E8 | Conversation deleted from sidebar | Expected UI behavior/check to pass | items 5 -> 4 | Pass | raw/browser-E1-E13.json |
| E11 | Conversations are grouped by date in the sidebar | Expected UI behavior/check to pass | group labels=['Today'] | Pass | raw/browser-E1-E13.json |
| E12 | Like on a reply is saved and still shown after reloading | Expected UI behavior/check to pass | aria-pressed after reload=true | Pass | raw/browser-E1-E13.json |
| E13 | Model menu shows the configured model and provider | Expected UI behavior/check to pass | Provider \| localhost:9100 \| Model \| openai/gpt-oss-20b \| Endpoint \| localhost:9100 \| Status \| Online | Pass | raw/browser-E1-E13.json |
| E9 | Mobile (390 px): input uses most of the width; sidebar hidden until opened | Expected UI behavior/check to pass | input width=370px, sidebar x=-319 w=319 | Pass | raw/browser-E1-E13.json |
| E9b | Mobile menu button opens the conversation list | Expected UI behavior/check to pass | sidebar x after open=0 | Pass | raw/browser-E1-E13.json |
| E10 | Backend offline: clear error and status | Expected UI behavior/check to pass | Cannot reach the SigmaGPT backend at http://localhost:8082. Check that it is running.; status=Backend offline | Pass | raw/browser-E1-E13.json |

Totals: 15 checks (including E6b and E9b): 15 passed. The supplied script tried to terminate the backend with Python `os.kill`, which Windows denied (`PermissionError: [WinError 5]`). I reran browser checks without forced termination and checked E10 separately after stopping only the backend I started via its terminal session.

## Mock latency

| Test ID | Procedure | Expected | Actual | Status | Evidence file |
| --- | --- | --- | --- | --- | --- |
| M1 | `evaluation/latency.mjs win` on mock-backed API; 50 fresh + 50 follow-up, 5 warmups | n=50 each; quantify app overhead only | New: n=50, mean 39.7 ms, median 30.9 ms, p95 104.8 ms, min 10.9 ms, max 216.6 ms. Follow-up: n=50, mean 88.3 ms, median 31.5 ms, p95 302.2 ms, min 12.6 ms, max 1584.1 ms. Mock only; application overhead, not Groq latency. | Pass | raw/mock-latency.json; raw/mock-latency.txt |

Mock latency is application overhead against the local mock provider; it is not Groq latency.

## Real Groq API

| Test ID | Procedure | Expected | Actual | Status | Evidence file |
| --- | --- | --- | --- | --- | --- |
| R-00 | Run `node Backend/test-groq.js` and screenshot terminal | Helper returns model/reply/tokens; terminal screenshot | Not run: `Backend/test-groq.js` is absent. Equivalent direct OpenAI SDK smoke call succeeded: model `openai/gpt-oss-20b`, reply `Connected and ready.`, 120 total tokens (42 completion); no terminal screenshot captured. | Not run (SDK fallback passed) | raw/real-R00-connectivity.txt |
| R-01 | Browser ask TCP/UDP; direct API capture of same prompt; verify stored thread | Relevant answer displayed and saved; HTTP 200 | HTTP 200 in 1899.2 ms; saved; exact reply in Appendix A; browser screenshot. | Pass | real_groq/R-01_general.png; raw/real-R01-R03-api.json |
| R-02 | Browser ask for Python string reversal; run returned code against 3 cases | Correct highlighted code with Copy; executable behavior | HTTP 200 in 859.9 ms; code block and Copy shown; three Python assertions passed. Exact reply in Appendix A. | Pass | real_groq/R-02_programming.png; raw/real-R02-code-execution.txt; raw/real-R01-R03-api.json |
| R-03 | Ask video-call follow-up in R-01 thread | Answer refers to prior TCP/UDP context | HTTP 200 in 1597.3 ms; reply explains UDP media and TCP signaling, explicitly names prior context. Exact answer in Appendix A. | Pass | real_groq/R-03_followup.png; raw/real-R01-R03-api.json |
| R-04 | Reload browser, reopen R-01, inspect Mongo thread | All turns reappear in order; record message count/roles | Browser reload screenshot; Mongo document contains 4 messages, roles user, assistant, user, assistant in order. | Pass | real_groq/R-04_persistence.png; raw/real-R04-persistence.json |
| R-05 | Process-only invalid API key on port 8090; send chat; verify DB | HTTP 502 safe auth error; no conversation saved | HTTP 502 in 706 ms; code AI_AUTH; body: The AI provider rejected the server's API key. Check OPENAI_API_KEY in Backend/.env.; matching thread count in separate DB=0. | Pass | raw/real-R05-invalid-key.txt; raw/real-R05-db-check.txt |
| R-06 | Observe provider responses without deliberately requesting a 429 | Do not force; report if any 429 occurs | Upstream/provider-mapped HTTP 429 observed naturally in R-07 after 5 warmups and 6 successful measured calls; safe AI_RATE_LIMIT JSON; run stopped immediately. | Pass (handled; 429 observed) | raw/real-latency.json |
| R-07 | Real latency test; two-second pause between every request; stop on non-200 | 50 successful new + 50 successful follow-up samples, no quota exhaustion | Partial only: 5 warmups succeeded; 3 successful new-chat + 3 successful follow-up measurements; next new-chat call returned HTTP 429 AI_RATE_LIMIT. Successful samples only: new {'n': 3, 'mean_ms': 2010.8, 'median_ms': 1919.4, 'p95_ms': 2675, 'min_ms': 1438, 'max_ms': 2675}; follow-up {'n': 3, 'mean_ms': 10479.0, 'median_ms': 2069.2, 'p95_ms': 27384.4, 'min_ms': 1983.5, 'max_ms': 27384.4}. No extrapolation. | Partial: stopped on 429 | raw/real-latency.json; raw/real-latency-summary.txt |

### Exact real replies from the API capture

The following are verbatim response texts from the captured direct API replay for R-01 through R-03. The corresponding real UI screenshots are linked in the table.

#### R-01 — TCP vs UDP

````text
**TCP (Transmission Control Protocol) vs. UDP (User Datagram Protocol)**  

| Feature | TCP | UDP |
|---------|-----|-----|
| **Connection type** | Connection‑oriented | Connectionless |
| **Handshake** | 3‑way handshake (SYN, SYN‑ACK, ACK) to establish a session | No handshake; packets are sent “as‑is” |
| **Reliability** | Guarantees delivery: lost segments are retransmitted; duplicates are removed | No guarantee; packets may be lost, duplicated, or arrive out of order |
| **Ordering** | Sequence numbers enforce in‑order delivery | No ordering guarantees; packets can arrive in any sequence |
| **Flow control** | Sliding window (receiver advertises how much it can accept) | None |
| **Congestion control** | Algorithms (e.g., Reno, Cubic) slow transmission when the network is congested | None; sends at the application’s chosen rate |
| **Overhead** | Higher (headers: 20 bytes + optional options) | Lower (header: 8 bytes) |
| **Speed** | Slower due to connection setup, acknowledgments, retransmissions | Faster for small messages because of minimal protocol processing |
| **Typical use cases** | Web pages (HTTP/HTTPS), file transfer (FTP, SFTP), email (SMTP, IMAP), remote login (SSH) | DNS lookups, VoIP (SIP, RTP), streaming media, online gaming, real‑time data feeds |

### Why the differences matter

1. **Reliability vs. Latency**  
   - *TCP* is chosen when you need the data to arrive intact and in order. The cost is a bit more latency (handshake + retransmissions).  
   - *UDP* is chosen when the application can tolerate occasional packet loss or can handle its own error checking (e.g., real‑time audio). The lower overhead gives lower latency.

2. **Stateful vs. Stateless**  
   - TCP maintains a stateful connection that remembers sequence numbers, acknowledgments, and congestion windows.  
   - UDP is stateless; each datagram is independent.

3. **Throughput and Efficiency**  
   - The handshake and retransmission logic in TCP can reduce throughput on very lossy networks, but it ensures that all data arrives.  
   - UDP’s minimal header and no retransmissions let you send high‑rate data streams without the delay of ack processing.

### Bottom line
- **Use TCP** when data integrity, ordering, and reliability are essential (e.g., web browsing, file transfer, email).  
- **Use UDP** when low latency, simplicity, or broadcasting is more important than perfect delivery (e.g., DNS, VoIP, live video, online games).

If you need more specifics for a particular scenario, let me know!
````

#### R-02 — Python reverse string

````text
Here’s a minimal, easy‑to‑read function that returns the reverse of any string passed to it:

```python
def reverse_string(s: str) -> str:
    """
    Return a new string containing the characters of `s` in reverse order.

    Parameters
    ----------
    s : str
        The string to reverse.

    Returns
    -------
    str
        The reversed string.
    """
    # The slice syntax `s[::-1]` steps through the string backwards.
    return s[::-1]
```

### How to use it

```python
>>> reverse_string("hello")
'olleh'

>>> reverse_string("")        # empty string
''

>>> reverse_string("A")
'A'
```

### A few alternate approaches

If you prefer something that works character‑by‑character:

```python
def reverse_string_loop(s: str) -> str:
    result = ""
    for char in s:
        result = char + result   # prepend each char
    return result
```

Or using the built‑in `reversed()` function:

```python
def reverse_string_reversed(s: str) -> str:
    return ''.join(reversed(s))
```

All three versions produce the same result; the slice version (`s[::-1]`) is the most concise and idiomatic for simple string reversal in Python.
````

#### R-03 — Video-call follow-up

````text
### Which protocol is used for video calls?

| Layer | Protocol | Typical usage in video‑call stacks |
|-------|----------|------------------------------------|
| **Signaling / control** | **TCP** (or SIP over TCP/UDP, WebSocket over TCP, etc.) | Establishing the call, negotiating codecs, handling call setup and teardown. |
| **Media transport** | **UDP** (usually RTP/RTCP over UDP) | Carrying the audio‑video payload in real time. |

So **the bulk of a video‑call uses UDP**, while TCP is typically reserved for the call‑control messages.

---

## Why UDP dominates for real‑time media

| Requirement | How UDP meets it | What TCP would cost |
|-------------|------------------|---------------------|
| **Low latency** | No connection handshake; packets are sent immediately. | 3‑way handshake and ACK processing add 0‑3 round‑trips. |
| **Tolerance for loss** | Real‑time codecs (H.264, Opus, etc.) can drop a few packets without noticeable artifact. | TCP would retransmit lost packets, introducing delay. |
| **Ordering** | RTP includes sequence numbers so the receiver can reorder if needed. | TCP guarantees ordering automatically, but that also forces the receiver to wait for missing data. |
| **Bandwidth efficiency** | Minimal header (8 bytes) → less overhead, more payload per packet. | TCP headers (20–40 bytes) plus ACKs and retransmission traffic consume bandwidth. |
| **Statelessness** | Each packet is independent; no per‑connection state to maintain. | Requires server to keep state for every stream, increasing resource usage. |

### What happens when packets are lost?

- **UDP**: The packet is simply dropped. The decoder can use error concealment or forward‑error‑correcting (FEC) data to mask gaps. The call continues with minimal delay.
- **TCP**: The sender must retransmit the lost segment. If the network is congested or the loss rate is high, this can stall the stream for many milliseconds—noticeable in a video call.

### How do real‑world systems handle it?

1. **RTP/RTCP over UDP**  
   - Most VoIP (SIP) and video‑conference systems use RTP (Real‑Time Transport Protocol) on top of UDP.  
   - RTCP provides quality‑of‑service feedback (packet loss, jitter, round‑trip time) to allow dynamic adjustment of bitrate or codec.

2. **WebRTC**  
   - Uses **DTLS‑SRTP** on UDP for secure media.  
   - The signalling channel uses a WebSocket (TCP) or HTTP‑like handshake, but media stays on UDP.

3. **Fallback to TCP or QUIC**  
   - If a network blocks UDP (e.g., strict corporate firewalls), some systems can switch to TCP‑based transports (e.g., WebRTC “TCP fallback”) or use **QUIC** (which runs on UDP but adds reliability and multiplexing).

---

## Summary

- **Video‑call media**: **UDP** (RTP/RTCP).  
- **Why**: It provides the low latency, small overhead, and loss tolerance needed for smooth, real‑time audio/video.  
- **TCP** remains useful for control/signaling messages that require reliability, ordering, and security.

If you’re building or choosing a video‑call solution, you’ll likely see UDP handling the media while TCP or a TCP‑like stream (WebSocket, DTLS, QUIC) handles the control channel.
````

## Totals and outstanding items

- Backend automated: 37/37 passed; frontend lint passed; production build passed with a >500 kB chunk warning.
- Black-box API: 21/21 passed. Failure scenarios: S1–S6 passed (S5/S6 manually adapted for Windows). Browser E2E: 15/15 passed after separately validating E10.
- Mock latency: 50/50 successful for each path. Real Groq UI/API: R-01 to R-06 passed; R-07 partial with six successful measured requests before a 429; full n=50 per path not completed.

### Not run / partial

- The project’s specified `Backend/test-groq.js` does not exist, so that exact command and its requested terminal screenshot were not run. An equivalent direct OpenAI SDK smoke request against Groq succeeded; its text output is in `raw/real-R00-connectivity.txt`.
- Full R-07 n=50 each was not completed: the provider returned HTTP 429 after the first six successful measured samples. The run stopped immediately; partial statistics only are reported.
- The exact shell invocation of S5/S6 via the supplied scenario runner did not complete because Windows `mongod` rejects `--fork`; equivalent checks were completed manually and recorded.

## Changes made

- No application source, project configuration, package manifests, lockfiles, or `.env` files were edited.
- Added test evidence under `evaluation/results_win/` and real UI screenshots under `evaluation/real_groq/`. A separate key-free test copy and temporary test infrastructure were used. User-owned listeners were not stopped; only processes started for these checks were stopped.
