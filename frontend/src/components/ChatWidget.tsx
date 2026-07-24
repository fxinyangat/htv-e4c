import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Send, Sparkles, ChevronRight, Plus, History as HistoryIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatContext } from '../context/ChatContext';
import { sendChatMessage, formatRelativeTime } from '../api';

interface Source {
  type: 'company' | 'policy';
  id?: string;
  name: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

// Dust emits its own citation directive syntax (":cite[shortId]") inline in agent replies —
// our markdown renderer doesn't understand it, so it shows up as ugly literal text. The
// citation format isn't consistent across every tool the agent might use in a given turn, so
// rather than trying to fragilely resolve each one to a real company link, we just strip them.
function stripCitations(content: string): string {
  return content.replace(/:cite\[[^\]]*\]/g, '');
}

// Defense in depth: if the agent ever emits a real markdown link into Notion instead of (or
// alongside) a :cite[] directive, degrade it to plain text rather than rendering a raw
// notion.so URL — internal Notion links aren't something app users should be clicking into.
function isNotionUrl(href?: string): boolean {
  if (!href) return false;
  try {
    return new URL(href).hostname.endsWith('notion.so');
  } catch {
    return false;
  }
}

// Device-local only — survives a refresh but doesn't follow the user across browsers/devices.
// Real cross-device history needs server-side storage tied to a logged-in user, once auth exists.
const CHAT_STORAGE_KEY = 'htv_chat_history_v1';

function loadStoredChat(): { messages: Message[]; conversationId: string | null } {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { messages: [], conversationId: null };
    const parsed = JSON.parse(raw);
    return { messages: parsed.messages ?? [], conversationId: parsed.conversationId ?? null };
  } catch {
    return { messages: [], conversationId: null };
  }
}

// A past conversation, archived on-device when the user starts a new one or switches away.
// Device-local for now, same caveat as CHAT_STORAGE_KEY above — real cross-device history
// needs the Chat Sessions database once auth exists.
interface ChatSession {
  id: string;
  conversationId: string | null;
  messages: Message[];
  updatedAt: number;
}

const CHAT_SESSIONS_KEY = 'htv_chat_sessions_v1';
const MAX_SESSIONS = 30;

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // localStorage unavailable — fine to skip persisting
  }
}

function sessionPreview(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  const text = firstUser?.content ?? 'New conversation';
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

function newSessionId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Never show a raw API/stack error to the user — but the specific failure still decides which
// friendly message to show, since "try again in a moment" (rate limit) and "try a simpler
// question" (timeout) call for different reactions than a generic fallback would suggest.
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/rate limit/i.test(message)) {
    return "The AI assistant is temporarily rate-limited — please wait a moment and try again.";
  }
  if (/timed out/i.test(message)) {
    return "That's taking longer than expected. Try a simpler question, or try again in a moment.";
  }
  if (/failed to respond|cancelled/i.test(message)) {
    return "The AI assistant couldn't complete that request. Please try again.";
  }
  return "Sorry, I couldn't reach the AI assistant. Please check your connection and try again.";
}

export default function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>(() => loadStoredChat().messages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [width, setWidth] = useState(() => window.innerWidth * 0.5);
  const [conversationId, setConversationId] = useState<string | null>(() => loadStoredChat().conversationId);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const consumedQueryRef = useRef<string | null>(null); // guards StrictMode's dev-mode double effect-invoke

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, conversationId }));
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — fine to skip persisting
    }
  }, [messages, conversationId]);

  const { activeCompanyName, isOpen, setIsOpen, pendingQuery, setPendingQuery } = useChatContext();
  const navigate = useNavigate();
  const location = useLocation();
  // Landing ('/') is the only route outside the internal app (AppLayout's /queue, /companies,
  // /metrics, /inbound) that this widget renders on — external visitors chatting from there
  // shouldn't get links that pull them into pages they can't otherwise reach.
  const isInternalPage = location.pathname !== '/';

  const handleSourceClick = (source: Source) => {
    if (source.type === 'company' && source.id) {
      navigate(`/companies?id=${source.id}`);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX - 24; // 24px is right-6
    // Upper bound is viewport-relative (not a fixed px cap) so it stays consistent with the
    // 50vw default on very wide screens instead of clamping back below it on first resize.
    if (newWidth >= 350 && newWidth <= window.innerWidth * 0.8) {
      setWidth(newWidth);
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [handleMouseMove, stopResizing]);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStatusText('Thinking…');

    try {
      const data = await sendChatMessage(userMsg.content, conversationId, setStatusText);
      setConversationId(data.conversationId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, sources: data.sources }]);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: describeError(error) }]);
    } finally {
      setIsLoading(false);
      setStatusText(null);
    }
  };

  // Picks up a query handed off from the Landing page's search box and sends it for real.
  // consumedQueryRef guards against StrictMode's dev-mode double effect-invoke — without it,
  // this fires the same real network request twice (refs, unlike state, survive that double-run
  // since React doesn't reset them between the two invocations).
  useEffect(() => {
    if (pendingQuery && consumedQueryRef.current !== pendingQuery) {
      consumedQueryRef.current = pendingQuery;
      setPendingQuery(null);
      setView('chat');
      handleSend(pendingQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuery]);

  // Snapshots the active thread into the history archive — called whenever the user is about
  // to leave it behind (New Chat, or switching to a different past conversation) so it's never
  // silently lost. No-ops on an empty thread (nothing worth archiving).
  function archiveCurrentSession() {
    if (messages.length === 0) return;
    const session: ChatSession = { id: newSessionId(), conversationId, messages, updatedAt: Date.now() };
    setSessions(prev => {
      const next = [session, ...prev].slice(0, MAX_SESSIONS);
      saveSessions(next);
      return next;
    });
  }

  function handleNewChat() {
    archiveCurrentSession();
    setMessages([]);
    setConversationId(null);
    setView('chat');
  }

  function handleSelectSession(session: ChatSession) {
    archiveCurrentSession();
    setMessages(session.messages);
    setConversationId(session.conversationId);
    setView('chat');
    // The session just loaded is "active" again now — drop it from the archive so it isn't
    // listed in both places at once.
    setSessions(prev => {
      const next = prev.filter(s => s.id !== session.id);
      saveSessions(next);
      return next;
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-ht-orange to-orange-400 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white transition-all transform hover:scale-105 z-50"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div 
      style={{ width: `${width}px` }}
      className="fixed bottom-6 right-6 h-[70vh] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20 z-50 transition-[height,transform] duration-200"
    >
      {/* Resize Handle */}
      <div 
        onMouseDown={startResizing}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-ht-blue/10 z-10 transition-colors"
      />
      {/* Header */}
      <div className="px-5 py-4 border-b border-ht-blue/10 flex justify-between items-center bg-white/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-ht-orange" />
          <h3 className="font-display font-semibold text-ht-blue">Ask AI</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            title="New chat"
            className="p-1.5 rounded-lg text-ht-blue/50 hover:text-ht-blue hover:bg-ht-blue/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView(v => v === 'history' ? 'chat' : 'history')}
            title="History"
            className={`p-1.5 rounded-lg transition-colors ${view === 'history' ? 'text-ht-orange bg-ht-orange/10' : 'text-ht-blue/50 hover:text-ht-blue hover:bg-ht-blue/5'}`}
          >
            <HistoryIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-ht-blue/50 hover:text-ht-blue transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="flex-1 overflow-y-auto p-5">
          {sessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
              <HistoryIcon className="w-10 h-10 text-ht-blue/30" />
              <p className="text-sm text-ht-blue/70 max-w-[220px]">No past conversations yet on this device.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className="w-full text-left p-3 rounded-xl border border-ht-blue/10 hover:border-ht-orange/30 hover:bg-ht-orange/5 transition-colors"
                >
                  <p className="text-sm text-ht-blue font-medium line-clamp-1">{sessionPreview(session.messages)}</p>
                  <p className="text-xs text-ht-blue/40 mt-1">{formatRelativeTime(session.updatedAt)} · {session.messages.length} messages</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Context Banner */}
      {activeCompanyName && (
        <div className="px-4 py-2 bg-ht-blue/5 border-b border-ht-blue/10 text-xs text-ht-blue/60 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Viewing context: <span className="font-semibold">{activeCompanyName}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
            <Sparkles className="w-10 h-10 text-ht-blue/30" />
            <p className="text-sm text-ht-blue/70 max-w-[200px]">
              Hello user_name, how can I assist you today?
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user'
                ? 'bg-gradient-to-tr from-ht-orange to-orange-400 text-white rounded-br-none'
                : 'bg-white border border-ht-blue/10 text-ht-blue rounded-bl-none prose prose-sm prose-orange'
                }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div className="flex flex-col gap-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => isNotionUrl(href)
                        ? <>{children}</>
                        : <a href={href} target="_blank" rel="noreferrer" className="text-ht-orange hover:underline">{children}</a>,
                    }}
                  >
                    {stripCitations(msg.content)}
                  </ReactMarkdown>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2 pt-2 border-t border-ht-blue/10 group">
                      <summary className="text-[10px] uppercase tracking-wider font-semibold text-ht-blue/40 flex items-center cursor-pointer hover:text-ht-blue/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="w-3 h-3 mr-1 transition-transform group-open:rotate-90" />
                        View Answer Sources
                      </summary>
                      <div className="flex flex-wrap gap-1.5 mt-2 pl-4">
                        {msg.sources.map((source, sIdx) => (
                          source.type === 'company' && isInternalPage ? (
                            <button
                              key={sIdx}
                              onClick={() => handleSourceClick(source)}
                              className="px-2 py-1 bg-ht-blue/5 hover:bg-ht-orange hover:text-white hover:border-ht-orange transition-colors text-ht-blue/70 text-[10px] rounded-md border border-ht-blue/10 font-medium cursor-pointer"
                            >
                              {source.name}
                            </button>
                          ) : (
                            <span key={sIdx} className="px-2 py-1 bg-ht-blue/5 text-ht-blue/70 text-[10px] rounded-md border border-ht-blue/10 font-medium">
                              {source.name}
                            </span>
                          )
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-none px-4 py-3 bg-white border border-ht-blue/10 text-ht-blue/50 text-sm shadow-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin" /> {statusText ?? 'Thinking…'}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white/80 border-t border-ht-blue/10">
        <div className="relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="w-full bg-white border border-ht-blue/10 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-ht-orange/20 resize-none max-h-32 min-h-[44px]"
            rows={1}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-1.5 bg-ht-orange text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-ht-orange transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
