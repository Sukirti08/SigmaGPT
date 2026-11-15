import "./Chat.css";
import { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import logo from "./assets/blacklogo.png";
import { setFeedback } from "./api.js";
import { BulbIcon, CapIcon, ChartIcon, CheckIcon, CodeIcon, CopyIcon, DocIcon, ThumbDownIcon, ThumbUpIcon, UserIcon } from "./icons.jsx";

// Safe Markdown rendering: raw HTML in model output is ignored (skipHtml), react-markdown's
// default URL filter removes javascript: links, and external links open without page access.
const markdownComponents = {
    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
    pre: ({ node: _node, children, ...props }) => <CodeBlock {...props}>{children}</CodeBlock>,
};

function CodeBlock({ children, ...props }) {
    const [copied, setCopied] = useState(false);
    const copy = async (event) => {
        const text = event.currentTarget.parentElement.querySelector("code")?.innerText ?? "";
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };
    return (
        <div className="codeBlock">
            <button className="copyButton" onClick={copy} aria-label="Copy code">{copied ? "Copied" : "Copy"}</button>
            <pre {...props}>{children}</pre>
        </div>
    );
}

const Markdown = ({ children }) => (
    <ReactMarkdown skipHtml rehypePlugins={[rehypeHighlight]} components={markdownComponents}>{children}</ReactMarkdown>
);

// Copy and feedback buttons under an assistant reply. Feedback is stored on the server.
function ReplyActions({ message, onFeedback }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };
    const rate = (value) => onFeedback(message, message.feedback === value ? null : value);
    return (
        <div className="replyActions">
            <button onClick={copy} aria-label="Copy reply" title="Copy">{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}</button>
            <button onClick={() => rate("up")} disabled={!message._id} aria-label="Good response" aria-pressed={message.feedback === "up"}
                className={message.feedback === "up" ? "active" : ""} title="Good response"><ThumbUpIcon size={16} /></button>
            <button onClick={() => rate("down")} disabled={!message._id} aria-label="Bad response" aria-pressed={message.feedback === "down"}
                className={message.feedback === "down" ? "active" : ""} title="Bad response"><ThumbDownIcon size={16} /></button>
        </div>
    );
}

const CAPABILITIES = [
    { icon: CodeIcon, cls: "c1", text: "Programming and coding help", prompt: "Write a Python program to add two numbers." },
    { icon: CapIcon, cls: "c2", text: "Academic concepts and explanations", prompt: "Explain the difference between TCP and UDP." },
    { icon: BulbIcon, cls: "c3", text: "Technical and general knowledge", prompt: "How does HTTPS keep data secure?" },
    { icon: DocIcon, cls: "c4", text: "Project ideas and guidance", prompt: "Suggest three project ideas for a web development course." },
    { icon: ChartIcon, cls: "c5", text: "Data analysis and machine learning", prompt: "What is machine learning? Explain with an example." },
];

function Chat() {
    const {newChat, prevChats, setPrevChats, reply, setPrompt, currThreadId} = useContext(MyContext);
    const [latestReply, setLatestReply] = useState(null);
    const [feedbackError, setFeedbackError] = useState("");

    useEffect(() => {
        if(reply === null) {
            setLatestReply(null); //prevchat load
            return;
        }

        if(!prevChats?.length) return;

        const content = reply.split(" "); //individual words

        let idx = 0;
        const interval = setInterval(() => {
            setLatestReply(content.slice(0, idx+1).join(" "));

            idx++;
            if(idx >= content.length) clearInterval(interval);
        }, 40);

        return () => clearInterval(interval);

    }, [prevChats, reply])

    const handleFeedback = async (message, value) => {
        const previous = message.feedback;
        const apply = (v) => setPrevChats((chats) => chats.map((c) => (c._id === message._id ? { ...c, feedback: v ?? undefined } : c)));
        apply(value);
        try {
            await setFeedback(currThreadId, message._id, value);
            setFeedbackError("");
        } catch (err) {
            apply(previous);
            setFeedbackError(err.message);
        }
    };

    const renderMessage = (chat, idx, isLast) => {
        if (chat.role === "user") {
            return (
                <div className="userDiv" key={chat._id ?? idx}>
                    <p className="userMessage">{chat.content}</p>
                    <span className="avatar userAvatar"><UserIcon size={20} /></span>
                </div>
            );
        }
        const typing = isLast && latestReply !== null;
        return (
            <div className="gptDiv" key={chat._id ?? idx}>
                <span className="avatar botAvatar"><img src={logo} alt="" /></span>
                <div className="botBody">
                    <div className="botBubble"><Markdown>{typing ? latestReply : chat.content}</Markdown></div>
                    <ReplyActions message={chat} onFeedback={handleFeedback} />
                </div>
            </div>
        );
    };

    return (
        <>
            {newChat && prevChats.length === 0 && (
                <div className="welcome">
                    <h1>Start a New Chat!</h1>
                    <p>Ask a question, request an explanation, or paste code. Follow-up questions use the earlier messages of the conversation.</p>
                    <div className="capabilities">
                        <div className="capTitle">Here are some things I can help you with:</div>
                        {CAPABILITIES.map((cap) => {
                            const Icon = cap.icon;
                            return (
                                <button key={cap.text} className="capItem" onClick={() => setPrompt(cap.prompt)} title={`Try: ${cap.prompt}`}>
                                    <Icon size={20} className={`capIcon ${cap.cls}`} /> <span>{cap.text}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            <div className="chats">
                {prevChats?.map((chat, idx) => renderMessage(chat, idx, idx === prevChats.length - 1))}
                {feedbackError && <p role="alert" className="feedbackError">{feedbackError}</p>}
            </div>
        </>
    )
}

export default Chat;
