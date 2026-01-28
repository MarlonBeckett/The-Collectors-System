'use client';

import { useState } from 'react';
import { ChatChoiceMetadata } from '@/types/database';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';

interface ChoiceButtonsProps {
  metadata: ChatChoiceMetadata;
  onSelect: (choice: string) => void;
  onActionTrigger?: (action: { type: 'log_purchase'; product?: string }) => void;
  disabled?: boolean;
}

export function ChoiceButtons({ metadata, onSelect, onActionTrigger, disabled = false }: ChoiceButtonsProps) {
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleOptionClick = (option: string) => {
    if (disabled) return;
    onSelect(option);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim() && !disabled) {
      onSelect(customInput.trim());
      setCustomInput('');
      setShowCustomInput(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {metadata.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(option)}
            disabled={disabled}
            className="px-3 py-1.5 text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {option}
          </button>
        ))}
        {metadata.allowCustom && !showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
            className="px-3 py-1.5 text-sm bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Other...
          </button>
        )}
      </div>

      {showCustomInput && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type your answer..."
            disabled={disabled}
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-input focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={disabled || !customInput.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(false);
              setCustomInput('');
            }}
            disabled={disabled}
            className="px-3 py-1.5 text-sm bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
