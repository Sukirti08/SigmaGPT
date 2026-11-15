import "./Sidebar.css";
import { useCallback, useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import {v1 as uuidv1} from "uuid";
import logo from "./assets/blacklogo.png";
import { deleteThread as apiDeleteThread, getThread, listThreads } from "./api.js";
import { ChatIcon, EditIcon, PlusIcon, TrashIcon } from "./icons.jsx";

const DAY = 24 * 60 * 60 * 1000;

// Group conversations by the time of their last update, as the server already sorts them newest first.
function groupThreads(threads, now = new Date()) {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const groups = [
        { label: "Today", items: [] },
        { label: "Previous 7 Days", items: [] },
        { label: "Older", items: [] },
    ];
    for (const t of threads) {
        const time = new Date(t.updatedAt).getTime();
        if (time >= startOfToday) groups[0].items.push(t);
        else if (time >= startOfToday - 7 * DAY) groups[1].items.push(t);
        else groups[2].items.push(t);
    }
    return groups.filter((g) => g.items.length > 0);
}

function Sidebar() {
    const {allThreads, setAllThreads, currThreadId, setNewChat, setPrompt, setReply, setCurrThreadId, setPrevChats,
        threadsVersion, sidebarOpen, setSidebarOpen} = useContext(MyContext);
    const [error, setError] = useState("");
    const [loadingList, setLoadingList] = useState(true);

    const getAllThreads = useCallback(async () => {
        try {
            const res = await listThreads();
            setAllThreads(res.map(thread => ({threadId: thread.threadId, title: thread.title, updatedAt: thread.updatedAt})));
            setError("");
        } catch(err) {
            setError(err.message);
        } finally {
            setLoadingList(false);
        }
    }, [setAllThreads]);

    // Reload when the active thread changes and after every successful reply (threadsVersion).
    useEffect(() => {
        getAllThreads();
    }, [currThreadId, threadsVersion, getAllThreads]);

    const createNewChat = () => {
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPrevChats([]);
        setSidebarOpen(false);
    }

    const changeThread = async (newThreadId) => {
        try {
            const messages = await getThread(newThreadId);
            setCurrThreadId(newThreadId);
            setPrevChats(messages);
            setNewChat(false);
            setReply(null);
            setError("");
            setSidebarOpen(false);
        } catch(err) {
            setError(err.status === 404 ? "That conversation no longer exists." : err.message);
            if (err.status === 404) getAllThreads();
        }
    }

    const deleteThread = async (thread) => {
        if (!window.confirm(`Delete the conversation "${thread.title}"? This cannot be undone.`)) return;
        try {
            await apiDeleteThread(thread.threadId);
            setAllThreads(prev => prev.filter(t => t.threadId !== thread.threadId));
            if (thread.threadId === currThreadId) createNewChat();
        } catch(err) {
            setError(err.message);
        }
    }

    const groups = groupThreads(allThreads || []);

    return (
        <section className={sidebarOpen ? "sidebar open" : "sidebar"} aria-label="Conversations">
            <div className="brandRow">
                <img src={logo} alt="" className="logo" />
                <span className="brandName">SigmaGPT</span>
                <button className="iconButton" onClick={createNewChat} aria-label="Start a new chat" title="New chat">
                    <EditIcon size={18} />
                </button>
            </div>

            <button className="newChatButton" onClick={createNewChat}>
                <PlusIcon size={18} /> New Chat
            </button>

            {error && <p role="alert" className="sidebarError">{error}</p>}

            <div className="history">
                {loadingList && <p className="emptyState">Loading conversations…</p>}
                {!loadingList && !error && allThreads.length === 0 && (
                    <p className="emptyState">No conversations yet. Send a message to start one.</p>
                )}
                {groups.map((group) => (
                    <div key={group.label} className="historyGroup">
                        <p className="groupLabel">{group.label}</p>
                        <ul>
                            {group.items.map((thread) => (
                                <li key={thread.threadId}
                                    onClick={() => changeThread(thread.threadId)}
                                    className={thread.threadId === currThreadId ? "highlighted" : ""}
                                    title={thread.title}
                                >
                                    <ChatIcon size={18} className="threadIcon" />
                                    <span className="threadTitle">{thread.title}</span>
                                    <button className="deleteBtn"
                                        aria-label={`Delete conversation ${thread.title}`}
                                        onClick={(e) => {
                                            e.stopPropagation(); //stop event bubbling
                                            deleteThread(thread);
                                        }}
                                    ><TrashIcon size={16} /></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default Sidebar;
