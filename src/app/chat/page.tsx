'use client';

// Force dynamic rendering to prevent static generation during build
// (Supabase client requires env vars that aren't available at build time)
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage as ChatMessageType, ChatSession } from '@/types/database';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { AppShell } from '@/components/layout/AppShell';
import {
  PaperAirplaneIcon,
  TrashIcon,
  Bars3Icon,
  XMarkIcon,
  PlusIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

// Session storage keys for persisting chat state
const STORAGE_KEY_SESSION = 'chat_current_session';
const STORAGE_KEY_DRAFT = 'chat_draft_input';

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Initialize from session storage
  useEffect(() => {
    const savedSessionId = sessionStorage.getItem(STORAGE_KEY_SESSION);
    const savedDraft = sessionStorage.getItem(STORAGE_KEY_DRAFT);

    if (savedDraft) {
      setInput(savedDraft);
    }

    // Load sessions, then determine which one to show
    loadSessions(savedSessionId);
  }, []);

  // Save input to session storage when it changes (for draft preservation)
  useEffect(() => {
    if (initialized) {
      if (input && !currentSessionId) {
        // Only save draft for new chats
        sessionStorage.setItem(STORAGE_KEY_DRAFT, input);
      } else if (!input || currentSessionId) {
        sessionStorage.removeItem(STORAGE_KEY_DRAFT);
      }
    }
  }, [input, currentSessionId, initialized]);

  // Save current session to storage when it changes
  useEffect(() => {
    if (initialized) {
      if (currentSessionId) {
        sessionStorage.setItem(STORAGE_KEY_SESSION, currentSessionId);
      } else {
        sessionStorage.removeItem(STORAGE_KEY_SESSION);
      }
    }
  }, [currentSessionId, initialized]);

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
      setLoadingHistory(false);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async (savedSessionId?: string | null) => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (data) {
      setSessions(data);

      // Check if there's a saved session that still exists
      if (savedSessionId && data.some(s => s.id === savedSessionId)) {
        setCurrentSessionId(savedSessionId);
      }
      // Otherwise, for first-time visitors, default to new chat (null)
      // Don't auto-select the most recent session
    }

    if (!data || data.length === 0) {
      setLoadingHistory(false);
    }
    setInitialized(true);
  };

  const loadMessages = async (sessionId: string) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
    setLoadingHistory(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;

    await supabase.from('chat_sessions').delete().eq('id', sessionId);

    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      sessionStorage.removeItem(STORAGE_KEY_SESSION);
    }

    await loadSessions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    // Clear draft immediately when submitting
    sessionStorage.removeItem(STORAGE_KEY_DRAFT);
    setLoading(true);

    // Optimistically add user message
    const tempUserMessage: ChatMessageType = {
      id: 'temp-user',
      user_id: '',
      session_id: currentSessionId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, sessionId: currentSessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Chat API error:', data);
        throw new Error(data.details || data.error || 'Failed to send message');
      }

      // Update session ID if this was a new chat
      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
        await loadSessions();
      }

      // Reload messages to get the actual IDs
      if (data.sessionId) {
        await loadMessages(data.sessionId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
      setInput(userMessage); // Restore the input
    } finally {
      setLoading(false);
    }
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-8rem)] w-full relative">
        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed md:relative left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } md:w-56 flex-shrink-0`}
        >
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h2 className="font-semibold text-sm">Chats</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-muted rounded md:hidden"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 m-2 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <PlusIcon className="w-4 h-4" />
              New Chat
            </button>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No chats yet
                </p>
              ) : (
                <div className="space-y-1 p-2">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`w-full flex items-start gap-2 p-2 text-left text-sm rounded hover:bg-muted group cursor-pointer ${
                        currentSessionId === session.id ? 'bg-muted' : ''
                      }`}
                    >
                      <ChatBubbleLeftIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSessionDate(session.updated_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 rounded transition-opacity"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-muted rounded md:hidden"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                {currentSessionId
                  ? sessions.find(s => s.id === currentSessionId)?.title || 'Chat'
                  : 'New Chat'}
              </h1>
              <p className="text-xs text-muted-foreground">Ask questions about your collection</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-6">What can I help you with?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg px-4">
                  {[
                    "Give me an overview of my collection",
                    "Which vehicles need attention right now?",
                    "What battery should I get for the TW200?",
                    "What maintenance should I do before riding season?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        // Auto-submit after setting input
                        setTimeout(() => {
                          const form = document.querySelector('form');
                          form?.requestSubmit();
                        }, 0);
                      }}
                      disabled={loading}
                      className="px-4 py-3 text-sm text-left bg-card border border-border hover:bg-muted hover:border-primary/50 transition-colors disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 rounded">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your collection..."
                disabled={loading}
                className="flex-1 px-4 py-3 text-base bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="min-h-[44px] px-4 py-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
