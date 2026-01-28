'use client';

import { useState } from 'react';
import { ChatAction } from '@/types/database';
import {
  WrenchScrewdriverIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

interface ActionButtonProps {
  action: ChatAction;
  onExecute: (action: ChatAction) => Promise<void>;
  disabled?: boolean;
  compact?: boolean; // Show as smaller button for inline use
}

const actionIcons: Record<ChatAction['actionType'], React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  update_mileage: CogIcon,
  log_purchase: ShoppingCartIcon,
  log_maintenance: WrenchScrewdriverIcon,
  set_status: ClipboardDocumentListIcon,
};

export function ActionButton({ action, onExecute, disabled = false, compact = false }: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const Icon = actionIcons[action.actionType] || CogIcon;

  const handleClick = async () => {
    if (disabled || loading || success) return;

    setLoading(true);
    setError(null);

    try {
      await onExecute(action);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading || success}
      className={`inline-flex items-center gap-1.5 border transition-colors ${
        compact
          ? 'px-2 py-1 text-xs'
          : 'px-3 py-1.5 text-sm'
      } ${
        success
          ? 'bg-green-500/10 text-green-600 border-green-500/30'
          : error
          ? 'bg-destructive/10 text-destructive border-destructive/30'
          : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/40'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={error || undefined}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : success ? (
        <CheckIcon className="w-4 h-4" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {!compact && action.label}
    </button>
  );
}

interface ActionButtonsProps {
  actions: ChatAction[];
  onExecute: (action: ChatAction) => Promise<void>;
  disabled?: boolean;
}

export function ActionButtons({ actions, onExecute, disabled = false }: ActionButtonsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <ActionButton
          key={index}
          action={action}
          onExecute={onExecute}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
