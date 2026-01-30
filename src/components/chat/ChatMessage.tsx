'use client';

import { ReactNode } from 'react';
import { ChatMessage as ChatMessageType, ChatAction, ChatChoiceMetadata, ChatActionMetadata, ChatSourcesMetadata } from '@/types/database';
import { ChoiceButtons } from './ChoiceButtons';
import { ActionButtons } from './ActionButton';
import { ProductList, SourceList } from './ProductCard';

interface ChatMessageProps {
  message: ChatMessageType;
  isLatest?: boolean; // Whether this is the most recent assistant message
  onChoiceSelect?: (choice: string) => void;
  onActionExecute?: (action: ChatAction) => Promise<void>;
  disabled?: boolean;
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

// Parse text and convert markdown links [text](url) with optional pricing - $XX.XX
// Format: [Product Name](url) - $XX.XX or just [text](url)
function renderContentWithLinks(content: string, isUser: boolean) {
  // Match markdown links with optional price: [text](url) - $XX.XX or plain URLs
  // Price pattern: optional " - $" followed by digits.digits
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\s*-\s*(\$[\d,]+\.?\d*))?|(https?:\/\/[^\s]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link [text](url) with optional price
      const linkText = match[1];
      const url = match[2];
      const price = match[3]; // Will be "$XX.XX" or undefined

      // Create a product recommendation element if price is present
      if (price) {
        parts.push(
          <span key={match.index} className="inline-flex items-baseline gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-medium ${isUser ? 'text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
            >
              {linkText}
            </a>
            <span className={`text-sm ${isUser ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {price}
            </span>
          </span>
        );
      } else {
        // Regular link without price
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline ${isUser ? 'text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
          >
            {linkText}
          </a>
        );
      }
    } else if (match[4]) {
      // Plain URL - show friendly hostname instead of full URL
      parts.push(
        <a
          key={match.index}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline ${isUser ? 'text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
        >
          {getUrlDisplayName(match[4])}
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

export function ChatMessage({ message, isLatest = false, onChoiceSelect, onActionExecute, disabled = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const metadata = message.metadata;

  // Only show interactive elements on the latest assistant message
  const canInteract = isLatest && !disabled;

  const isChoiceMetadata = (m: typeof metadata): m is ChatChoiceMetadata =>
    m !== null && m !== undefined && m.type === 'choice';

  const isActionMetadata = (m: typeof metadata): m is ChatActionMetadata =>
    m !== null && m !== undefined && m.type === 'action';

  const isSourcesMetadata = (m: typeof metadata): m is ChatSourcesMetadata =>
    m !== null && m !== undefined && m.type === 'sources';

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

        {/* Choice buttons for assistant messages - only interactive on latest */}
        {!isUser && isChoiceMetadata(metadata) && onChoiceSelect && (
          <ChoiceButtons
            metadata={metadata}
            onSelect={onChoiceSelect}
            disabled={!canInteract}
          />
        )}

        {/* Action buttons for assistant messages - only interactive on latest */}
        {!isUser && isActionMetadata(metadata) && onActionExecute && (
          <ActionButtons
            actions={metadata.actions}
            onExecute={onActionExecute}
            disabled={!canInteract}
          />
        )}

        {/* Sources and Products - rendered after message content */}
        {!isUser && isSourcesMetadata(metadata) && (
          <>
            {metadata.sources.length > 0 && (
              <SourceList sources={metadata.sources} />
            )}
            {metadata.products.length > 0 && (
              <ProductList products={metadata.products} vehicleContext={metadata.vehicleContext} />
            )}
          </>
        )}

        <p className={`text-xs mt-2 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
