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
  ChevronDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// Session storage keys for persisting chat state
const STORAGE_KEY_SESSION = 'chat_current_session';
const STORAGE_KEY_DRAFT = 'chat_draft_input';
// Use the same key as dashboard for shared collection memory
const STORAGE_KEY_COLLECTION = 'selectedCollectionId';

interface CollectionOption {
  id: string;
  name: string;
  is_owner: boolean;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionDropdownOpen, setCollectionDropdownOpen] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const collectionDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipNextMessageLoad = useRef(false);
  const supabase = createClient();

  // Initialize from session storage and load collections
  useEffect(() => {
    const savedSessionId = sessionStorage.getItem(STORAGE_KEY_SESSION);
    const savedDraft = sessionStorage.getItem(STORAGE_KEY_DRAFT);

    if (savedDraft) {
      setInput(savedDraft);
    }

    // Load collections first, then sessions
    loadCollections().then((loadedCollections) => {
      // Get selected collection from localStorage (shared with dashboard)
      const storedCollectionId = localStorage.getItem(STORAGE_KEY_COLLECTION);
      let collectionId: string | null = null;

      if (storedCollectionId && loadedCollections.some((c: CollectionOption) => c.id === storedCollectionId)) {
        collectionId = storedCollectionId;
      } else if (loadedCollections.length > 0) {
        collectionId = loadedCollections[0].id;
      }

      setSelectedCollectionId(collectionId);

      // Load sessions and suggestions after collection is set
      loadSessions(savedSessionId);
      if (collectionId) {
        loadSuggestions(collectionId);
      }
    });
  }, []);

  // Close collection dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (collectionDropdownRef.current && !collectionDropdownRef.current.contains(event.target as Node)) {
        setCollectionDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCollections = async (): Promise<CollectionOption[]> => {
    const { data } = await supabase.rpc('get_user_collections');
    if (data) {
      const options: CollectionOption[] = data.map((c: { id: string; name: string; is_owner: boolean }) => ({
        id: c.id,
        name: c.name,
        is_owner: c.is_owner,
      }));
      setCollections(options);
      return options;
    }
    return [];
  };

  const loadSuggestions = async (collectionId?: string) => {
    try {
      const url = collectionId
        ? `/api/chat/suggestions?collectionId=${collectionId}`
        : '/api/chat/suggestions';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
        }
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

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
    // Skip loading if we just set messages with metadata from API response
    if (skipNextMessageLoad.current) {
      skipNextMessageLoad.current = false;
      return;
    }

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
    // Reload suggestions for the current collection
    if (selectedCollectionId) {
      loadSuggestions(selectedCollectionId);
    }
  };

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setCollectionDropdownOpen(false);
    // Note: We don't save to localStorage here - only the main dashboard selector updates the memory
    // Clear current chat and reload suggestions for the new collection
    setCurrentSessionId(null);
    setMessages([]);
    loadSuggestions(collectionId);
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

    // Research mode triggers research indicator
    if (researchMode) {
      setIsResearching(true);
    }

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
        body: JSON.stringify({
          message: userMessage,
          sessionId: currentSessionId,
          collectionId: selectedCollectionId,
          researchMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Chat API error:', data);
        throw new Error(data.details || data.error || 'Failed to send message');
      }

      // Add assistant message directly with metadata instead of reloading
      // This preserves the research metadata for rich rendering
      console.log('API response data:', data);
      console.log('API metadata:', data.metadata);

      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        user_id: '',
        session_id: data.sessionId,
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
        metadata: data.metadata,
      };

      console.log('Assistant message with metadata:', assistantMessage);

      // Replace temp message with actual user message and add assistant response
      setMessages(prev => {
        const updated = prev.filter(m => m.id !== 'temp-user');
        return [...updated, {
          ...tempUserMessage,
          id: `user-${Date.now()}`,
        }, assistantMessage];
      });

      // Update session ID AFTER setting messages to avoid useEffect reloading from DB
      if (data.sessionId && data.sessionId !== currentSessionId) {
        // Temporarily disable the loadMessages effect by setting a flag
        skipNextMessageLoad.current = true;
        setCurrentSessionId(data.sessionId);
        await loadSessions();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
      setInput(userMessage); // Restore the input
    } finally {
      setLoading(false);
      setIsResearching(false);
    }
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();

    // Compare calendar days by zeroing out the time component
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-9rem)] w-full relative">
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
              {/* Collection selector - inline dropdown */}
              {collections.length > 1 ? (
                <div className="relative" ref={collectionDropdownRef}>
                  <button
                    onClick={() => setCollectionDropdownOpen(!collectionDropdownOpen)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {collections.find(c => c.id === selectedCollectionId)?.name || 'Select collection'}
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${collectionDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {collectionDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border shadow-lg z-50">
                      {collections.map((collection) => (
                        <button
                          key={collection.id}
                          onClick={() => handleCollectionChange(collection.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{collection.name}</div>
                            {!collection.is_owner && (
                              <div className="text-xs text-muted-foreground">Shared with you</div>
                            )}
                          </div>
                          {collection.id === selectedCollectionId && (
                            <CheckIcon className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Ask questions about your collection</p>
              )}
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
                {suggestions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg px-4">
                    {suggestions.map((suggestion) => (
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
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg px-4">
                    <div className="px-4 py-3 bg-card border border-border animate-pulse h-12" />
                    <div className="px-4 py-3 bg-card border border-border animate-pulse h-12" />
                    <div className="px-4 py-3 bg-card border border-border animate-pulse h-12" />
                    <div className="px-4 py-3 bg-card border border-border animate-pulse h-12" />
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onSelectOption={(option) => {
                    // When user clicks an option from discovery results, submit it as a new message
                    setInput(option);
                    setResearchMode(true); // Keep research mode active
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      form?.requestSubmit();
                    }, 0);
                  }}
                />
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3">
                  {isResearching ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-6 h-6">
                        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-muted"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            className="text-primary animate-progress-fill"
                            strokeDasharray="62.83"
                            strokeDashoffset="62.83"
                            style={{
                              animation: 'progress-fill 20s ease-out forwards',
                            }}
                          />
                        </svg>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Researching products...</span>
                        <br />
                        <span className="text-xs">Searching retailers and comparing options</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {/* Research mode indicator */}
            {researchMode && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-primary/10 border border-primary/20 text-sm">
                <MagnifyingGlassIcon className="w-4 h-4 text-primary" />
                <span className="text-primary font-medium">Research Mode</span>
                <button
                  type="button"
                  onClick={() => setResearchMode(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-background border border-input focus-within:ring-2 focus-within:ring-ring">
                <button
                  type="button"
                  onClick={() => setResearchMode(!researchMode)}
                  disabled={loading || !selectedCollectionId}
                  className={`p-3 transition-colors disabled:opacity-50 ${
                    researchMode
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title="Research products for your vehicles"
                >
                  <MagnifyingGlassIcon className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    !selectedCollectionId
                      ? "Select a collection to start..."
                      : researchMode
                        ? "What are you looking for? (e.g., battery for the TW200)"
                        : "Ask about your collection..."
                  }
                  disabled={loading || !selectedCollectionId}
                  className="flex-1 px-2 py-3 text-base bg-transparent focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim() || !selectedCollectionId}
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
