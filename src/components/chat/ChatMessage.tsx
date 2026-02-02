'use client';

import { ReactNode } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/database';
import { ProductList } from './ProductCard';
import { ResearchResult, DiscoveryResult } from '@/types/research';

interface ChatMessageProps {
  message: ChatMessageType;
  onSelectOption?: (option: string) => void;
}

interface VehicleContext {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  name?: string;
}

// Extract research result if present
function getResearchResult(metadata?: Record<string, unknown>): ResearchResult | null {
  if (metadata?.type === 'product_research' && metadata?.researchResult) {
    const result = metadata.researchResult as ResearchResult;
    // Validate that recommendations is an array
    if (!Array.isArray(result.recommendations)) {
      return null;
    }
    return result;
  }
  return null;
}

// Extract discovery result if present
function getDiscoveryResult(metadata?: Record<string, unknown>): DiscoveryResult | null {
  if (metadata?.type === 'discovery' && metadata?.discoveryResult) {
    return metadata.discoveryResult as DiscoveryResult;
  }
  return null;
}

// Extract vehicle context from metadata
function getVehicleContext(metadata?: Record<string, unknown>): VehicleContext | null {
  if (metadata?.vehicleContext) {
    return metadata.vehicleContext as VehicleContext;
  }
  return null;
}

// Build intro text based on vehicle context
function buildIntroText(vehicleContext: VehicleContext | null): string {
  if (vehicleContext) {
    const parts = [vehicleContext.year, vehicleContext.make, vehicleContext.model].filter(Boolean);
    const vehicleStr = parts.length > 0 ? parts.join(' ') : vehicleContext.name;
    if (vehicleStr) {
      return `Based on your ${vehicleStr}, here are my top recommendations:`;
    }
  }
  return 'Here are my top recommendations:';
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

export function ChatMessage({ message, onSelectOption }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const researchResult = getResearchResult(message.metadata);
  const discoveryResult = getDiscoveryResult(message.metadata);
  const vehicleContext = getVehicleContext(message.metadata);

  // For discovery phase messages, render option buttons
  if (!isUser && discoveryResult) {
    const vehicleStr = vehicleContext
      ? [vehicleContext.year, vehicleContext.make, vehicleContext.model].filter(Boolean).join(' ')
      : 'your vehicle';

    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] md:max-w-[85%] px-4 py-3 bg-card border border-border text-card-foreground">
          <p className="text-sm font-medium mb-3">
            Here&apos;s what I found about options for your {vehicleStr}:
          </p>

          {/* OEM Spec */}
          {discoveryResult.oemSpec && (
            <div className="mb-4 p-3 bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">OEM Specification</p>
              <p className="text-sm font-medium">{discoveryResult.oemSpec}</p>
            </div>
          )}

          {/* Product Types as clickable options */}
          {discoveryResult.productTypes.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Your main options:</p>
              <div className="space-y-2">
                {discoveryResult.productTypes.map((type, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectOption?.(`Show me ${type.name.toLowerCase()} options`)}
                    className="w-full text-left p-3 border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{type.name}</span>
                      {type.priceRange && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{type.priceRange}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                    {type.prosAndCons && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {type.prosAndCons.pros?.slice(0, 2).map((pro, i) => (
                          <span key={`pro-${i}`} className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400">
                            +{pro}
                          </span>
                        ))}
                        {type.prosAndCons.cons?.slice(0, 1).map((con, i) => (
                          <span key={`con-${i}`} className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400">
                            -{con}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Key Considerations */}
          {discoveryResult.keyConsiderations.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Things to consider:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {discoveryResult.keyConsiderations.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Popular Brands */}
          {discoveryResult.popularBrands.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground">
                Popular brands: {discoveryResult.popularBrands.join(', ')}
              </p>
            </div>
          )}

          {/* Show All button */}
          <button
            onClick={() => onSelectOption?.('Show me all options')}
            className="w-full mt-2 py-2 text-sm font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
          >
            Show me all options
          </button>

          <p className="text-xs mt-3 text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // For product research messages, render structured cards
  if (!isUser && researchResult) {
    // Build intro text from vehicle context (from metadata, not parsing content)
    const introText = buildIntroText(vehicleContext);

    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] md:max-w-[85%] px-4 py-3 bg-card border border-border text-card-foreground">
          <p className="text-sm mb-4">{introText}</p>
          <ProductList
            recommendations={researchResult.recommendations}
            sources={researchResult.sources}
          />
          <p className="text-xs mt-3 text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Standard message rendering
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
