import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect, useRef, useCallback } from "react";
import {ScaleLoader} from "react-spinners";
import { getHealth, sendMessage } from "./api.js";
import { ChevronIcon, CloseIcon, MenuIcon, SendIcon } from "./icons.jsx";

const MAX_MESSAGE_CHARS = 8000;

function ChatWindow() {
    const {prompt, setPrompt, setReply, currThreadId, setPrevChats, setNewChat, refreshThreads, sidebarOpen, setSidebarOpen,
        health, setHealth} = useContext(MyContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const activeThread = useRef(currThreadId);

    useEffect(() => { activeThread.current = currThreadId; }, [currThreadId]);

    const checkHealth = useCallback(async () => setHealth(await getHealth()), [setHealth]);
    useEffect(() => { checkHealth(); }, [checkHealth]);

    const getReply = async () => {
        const message = prompt.trim();
        if (!message || loading) return;
        if (message.length > MAX_MESSAGE_CHARS) {
            setError(`Messages must be ${MAX_MESSAGE_CHARS} characters or fewer.`);
            return;
        }

        const threadAtSend = currThreadId;
        setLoading(true);
        setError("");
        setReply(null);
        setNewChat(false);

        try {
            const res = await sendMessage(threadAtSend, message);
            refreshThreads();
            // If the user opened another conversation meanwhile, the reply is saved but not shown here.
            if (activeThread.current !== threadAtSend) return;
            setPrevChats(prevChats => ([
                ...prevChats,
                { _id: res.userMessageId, role: "user", content: message },
                { _id: res.messageId, role: "assistant", content: res.reply }
            ]));
            setReply(res.reply);
            setPrompt("");
        } catch(err) {
            setError(err.message);
            checkHealth();
        } finally {
            setLoading(false);
        }
    }

    const online = health && health.status === "ok";
    const statusText = !health ? "Checking…" :
        online ? "Online" :
        health.status === "unreachable" ? "Backend offline" :
        health.database !== "connected" ? "Database unavailable" : "Degraded";

    return (
        <div className="chatWindow">
            <div className="navbar">
                <button className="menuButton" aria-label={sidebarOpen ? "Hide conversations" : "Show conversations"}
                    onClick={() => setSidebarOpen(!sidebarOpen)}>
                    {sidebarOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
                </button>
                <div className="modelMenu">
                    <button className="modelButton" aria-haspopup="true" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                        SigmaGPT <ChevronIcon size={18} />
                    </button>
                    {menuOpen && (
                        <div className="modelPanel" role="dialog" aria-label="Model information">
                            <div><span>Provider</span><b>{health?.provider === "api.groq.com" ? "Groq" : (health?.provider ?? "Unknown")}</b></div>
                            <div><span>Model</span><b>{health?.model ?? "Unknown"}</b></div>
                            <div><span>Endpoint</span><b>{health?.provider ?? "Unknown"}</b></div>
                            <div><span>Status</span><b>{statusText}</b></div>
                            <p>The model is configured on the server (OPENAI_MODEL).</p>
                        </div>
                    )}
                </div>
                <span className={online ? "status online" : "status offline"} title={health?.error || ""}>
                    <span className="dot" /> {online ? `Online · ${health.model}` : statusText}
                </span>
            </div>

            <Chat></Chat>

            <div className="feedback" aria-live="polite">
                {loading && (
                    <div className="thinking">
                        <ScaleLoader color="#9db4d6" height={16} />
                        <span>SigmaGPT is thinking…</span>
                    </div>
                )}
                {error && (
                    <div role="alert" className="errorMessage">
                        <span>{error}</span>
                        <button onClick={getReply} disabled={loading || !prompt.trim()}>Retry</button>
                        <button onClick={() => setError("")} aria-label="Dismiss error">Dismiss</button>
                    </div>
                )}
            </div>

            <div className="chatInput">
                <div className="inputBox">
                    <input placeholder="Type your message here…"
                        aria-label="Message"
                        value={prompt}
                        maxLength={MAX_MESSAGE_CHARS}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                getReply();
                            }
                        }}
                    >
                    </input>
                    <button id="submit" aria-label="Send message" disabled={loading || !prompt.trim()} onClick={getReply}>
                        <SendIcon size={20} />
                    </button>
                </div>
                <p className="info">
                    {prompt.length > MAX_MESSAGE_CHARS * 0.9 && `${prompt.length}/${MAX_MESSAGE_CHARS} characters · `}
                    SigmaGPT can make mistakes. Check important info.
                </p>
            </div>
        </div>
    )
}

export default ChatWindow;
