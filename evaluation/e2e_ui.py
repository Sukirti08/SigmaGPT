"""Browser end-to-end checks with Playwright (Chromium, headless).
Usage: python e2e_ui.py <label> <backend_pid> <screenshot_dir or ->
Assumes: frontend preview at http://localhost:4173, backend at :8080 using the mock OpenAI server."""
import json, os, signal, sys, time
from playwright.sync_api import sync_playwright

label, backend_pid, shots = sys.argv[1], int(sys.argv[2]), sys.argv[3]
URL = "http://localhost:4173"
results = []

def rec(tid, name, ok, observed):
    results.append({"id": tid, "name": name, "pass": bool(ok), "observed": observed})

def shot(page, name):
    if shots != "-":
        os.makedirs(shots, exist_ok=True)
        page.screenshot(path=os.path.join(shots, name), full_page=False)

def wait_reply(page, text, timeout=10000):
    page.wait_for_function("t => [...document.querySelectorAll('.gptDiv')].some(d => d.innerText.includes(t))", arg=text, timeout=timeout)

def send(page, msg):
    box = page.locator('input[aria-label="Message"], input[placeholder="Ask anything"]')
    box.fill(msg)
    box.press("Enter")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.on("dialog", lambda d: d.accept())
    page.goto(URL)
    page.wait_for_timeout(1500)

    # E1 logo loads in the production build
    w = page.evaluate("() => { const i = document.querySelector('.sidebar img'); return i ? i.naturalWidth : -1 }")
    rec("E1", "Sidebar logo loads in production build", w > 0, f"naturalWidth={w}")
    shot(page, "01_home.png")

    # E2 send a message
    try:
        send(page, "Explain recursion"); wait_reply(page, "MOCK_REPLY")
        rec("E2", "Message sent and reply displayed", True, "reply shown")
    except Exception as e:
        rec("E2", "Message sent and reply displayed", False, str(e)[:120])

    # E3 sidebar shows the new conversation without switching
    page.wait_for_timeout(2000)
    titles = page.locator(".history li").all_inner_texts()
    rec("E3", "New conversation appears in sidebar after first reply", any("Explain recursion" in t for t in titles), f"sidebar items={titles[:3]}")

    # E4 follow-up uses context
    try:
        send(page, "Give another example"); wait_reply(page, "messages=4")
        rec("E4", "Follow-up question sent with history (messages=4)", True, "mock reports 4 messages")
    except Exception as e:
        rec("E4", "Follow-up question sent with history (messages=4)", False, str(e)[:120])

    # E5 new chat, then switch back
    page.locator(".sidebar button").first.click(); page.wait_for_timeout(500)
    cleared = page.locator(".gptDiv").count() == 0
    send(page, "Second topic"); 
    try: wait_reply(page, "Second topic")
    except Exception: pass
    page.wait_for_timeout(1500)
    page.locator(".history li", has_text="Explain recursion").first.click(); page.wait_for_timeout(1500)
    body = page.locator(".chats").inner_text()
    rec("E5", "New chat starts empty; switching back loads earlier messages", cleared and "Give another example" in body, f"cleared={cleared}, earlier messages loaded={'Give another example' in body}")

    # E6 Markdown rendering and safety
    page.locator(".sidebar button").first.click(); page.wait_for_timeout(500)
    send(page, "__MARKDOWN__")
    try: wait_reply(page, "safe link", timeout=15000)
    except Exception: pass
    page.wait_for_timeout(3500)  # let the word-by-word reveal finish
    info = page.evaluate("""() => {
        const g = [...document.querySelectorAll('.gptDiv')].pop(); const d = g.querySelector('.botBubble') || g;  // reply text only, not the avatar
        const links = [...d.querySelectorAll('a')].map(a => a.getAttribute('href'));
        return { img: d.querySelectorAll('img').length, code: !!d.querySelector('pre code.hljs, pre code[class*="language-"]'),
                 links, copy: !!d.querySelector('.copyButton'), heading: !!d.querySelector('h2') }
    }""")
    page.locator(".gptDiv a", has_text="unsafe link").first.click(); page.wait_for_timeout(300)
    xss = page.evaluate("() => window.__xss ?? null")
    safe = info["img"] == 0 and xss is None and not any((h or "").startswith("javascript") for h in info["links"])
    rec("E6", "Markdown rendered; raw HTML and javascript: links neutralised", safe and info["code"] and info["heading"], json.dumps({**info, "xss": xss}))
    rec("E6b", "Code blocks have a copy button", info["copy"], f"copy button={info['copy']}")
    shot(page, "02_markdown_code.png")

    # E7 provider error shown, prompt kept
    send(page, "__ERROR500__")
    try:
        page.wait_for_selector("[role=alert]", timeout=10000)
        alert = page.locator("[role=alert]").first.inner_text()
        kept = page.locator('input[aria-label="Message"], input[placeholder="Ask anything"]').input_value()
        rec("E7", "Provider error shown to user and prompt kept for retry", bool(alert) and kept == "__ERROR500__", f"alert='{alert[:90]}', input='{kept}'")
    except Exception as e:
        rec("E7", "Provider error shown to user and prompt kept for retry", False, str(e)[:120])
    shot(page, "03_error.png")
    page.locator('input[aria-label="Message"], input[placeholder="Ask anything"]').fill("")

    # E8 delete a conversation
    # Icons come from a CDN that is blocked in the test sandbox, so the click is dispatched directly.
    try:
        before = page.locator(".history li").count()
        item = page.locator(".history li", has_text="Second topic").first
        item.locator(".deleteBtn, .fa-trash").dispatch_event("click", timeout=5000); page.wait_for_timeout(1500)
        after = page.locator(".history li").count()
        rec("E8", "Conversation deleted from sidebar", after == before - 1, f"items {before} -> {after}")
    except Exception as e:
        rec("E8", "Conversation deleted from sidebar", False, str(e).splitlines()[0][:120])

    # E11-E13: interface features added in revision 2 (not present in revision 1)
    if page.locator(".groupLabel").count():
        labels = page.locator(".groupLabel").all_inner_texts()
        rec("E11", "Conversations are grouped by date in the sidebar", "Today" in labels, f"group labels={labels}")
        try:
            page.locator(".history li", has_text="Explain recursion").first.click(); page.wait_for_timeout(1200)
            up = page.locator(".gptDiv .replyActions button[aria-label='Good response']").last
            up.click(); page.wait_for_timeout(800)
            page.reload(); page.wait_for_timeout(1500)
            page.locator(".history li", has_text="Explain recursion").first.click(); page.wait_for_timeout(1200)
            pressed = page.locator(".gptDiv .replyActions button[aria-label='Good response']").last.get_attribute("aria-pressed")
            rec("E12", "Like on a reply is saved and still shown after reloading", pressed == "true", f"aria-pressed after reload={pressed}")
        except Exception as e:
            rec("E12", "Like on a reply is saved and still shown after reloading", False, str(e).splitlines()[0][:120])
        shot(page, "07_feedback_and_history.png")
        page.locator(".modelButton").click(); page.wait_for_timeout(400)
        panel = page.locator(".modelPanel").inner_text() if page.locator(".modelPanel").count() else ""
        rec("E13", "Model menu shows the configured model and provider", "openai/gpt-oss-20b" in panel and "Provider" in panel, panel.replace(chr(10), " | ")[:100])
        shot(page, "08_model_menu.png")
        page.locator(".modelButton").click()
        page.locator(".sidebar button").first.click(); page.wait_for_timeout(500)
        shot(page, "09_home_capabilities.png")

    # E9 narrow (mobile) layout
    m = browser.new_page(viewport={"width": 390, "height": 844})
    m.goto(URL); m.wait_for_timeout(1500)
    box = (m.locator('.inputBox') if m.locator('.inputBox').count() else m.locator('input[aria-label="Message"], input[placeholder="Ask anything"]')).bounding_box()
    sb = m.locator(".sidebar").bounding_box()
    sidebar_visible = sb is not None and sb["x"] + sb["width"] > 5
    rec("E9", "Mobile (390 px): input uses most of the width; sidebar hidden until opened",
        box["width"] > 300 and not sidebar_visible, f"input width={int(box['width'])}px, sidebar x={int(sb['x'])} w={int(sb['width'])}")
    shot(m, "04_mobile_chat.png")
    if m.locator(".menuButton").count():
        m.locator(".menuButton").dispatch_event("click"); m.wait_for_timeout(500)
        sb2 = m.locator(".sidebar").bounding_box()
        rec("E9b", "Mobile menu button opens the conversation list", sb2["x"] >= -1, f"sidebar x after open={int(sb2['x'])}")
        shot(m, "05_mobile_sidebar.png")
    else:
        rec("E9b", "Mobile menu button opens the conversation list", False, "no menu button")
    m.close()

    # E10 backend stopped
    os.kill(backend_pid, signal.SIGTERM); time.sleep(1.5)
    send(page, "Are you there?")
    try:
        page.wait_for_selector("[role=alert]", timeout=8000)
        alert = page.locator("[role=alert]").first.inner_text()
        status = page.locator(".status").inner_text() if page.locator(".status").count() else "(no status indicator)"
        rec("E10", "Backend offline: clear error and status", "backend" in alert.lower() or "reach" in alert.lower(), f"alert='{alert[:90]}', status='{status}'")
    except Exception as e:
        rec("E10", "Backend offline: clear error and status", False, str(e)[:120])
    shot(page, "06_backend_offline.png")
    browser.close()

print(json.dumps({"label": label, "results": results}, indent=1))
