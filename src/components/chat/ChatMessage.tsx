'use client';

import { ReactNode } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/database';

interface ChatMessageProps {
  message: ChatMessageType;
}

// Get a friendly display name for a URL
function getUrlDisplayName(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Link';
  }
}

// Parse text and convert markdown links [text](url) and plain URLs to clickable links
function renderContentWithLinks(content: string, isUser: boolean) {
  // Match markdown links [text](url) or plain URLs
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline ${isUser ? 'text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      // Plain URL - show friendly hostname instead of full URL
      parts.push(
        <a
          key={match.index}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline ${isUser ? 'text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
        >
          {getUrlDisplayName(match[3])}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border text-card-foreground'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{renderContentWithLinks(message.content, isUser)}</p>
        <p className={`text-xs mt-2 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
