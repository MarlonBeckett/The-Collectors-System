'use client';

import { useState } from 'react';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface InviteModalProps {
  collectionId: string;
  onClose: () => void;
}

type InviteRole = 'editor' | 'viewer';

export function InviteModal({ collectionId, onClose }: InviteModalProps) {
  const [role, setRole] = useState<InviteRole>('editor');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInvite = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/collections/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate invite');
        return;
      }

      setInviteCode(data.inviteCode);
      setExpiresAt(data.expiresAt);
    } catch {
      setError('Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatExpiration = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!inviteCode ? (
            <>
              {/* Role Selection */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Select Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRole('editor')}
                    className={`p-3 border text-left transition-colors ${
                      role === 'editor'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">Editor</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Can add, edit, and delete vehicles
                    </div>
                  </button>
                  <button
                    onClick={() => setRole('viewer')}
                    className={`p-3 border text-left transition-colors ${
                      role === 'viewer'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium">Viewer</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Read-only access to vehicles
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateInvite}
                disabled={generating}
                className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {generating ? 'Generating...' : 'Generate Invite Code'}
              </button>
            </>
          ) : (
            <>
              {/* Generated Code Display */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Invite Code
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted px-4 py-3 font-mono text-xl tracking-widest text-center">
                    {inviteCode}
                  </div>
                  <button
                    onClick={copyCode}
                    className="p-3 border border-border hover:bg-muted transition-colors"
                    title="Copy code"
                  >
                    {copied ? (
                      <CheckIcon className="w-5 h-5 text-secondary" />
                    ) : (
                      <ClipboardDocumentIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Role: <span className="text-foreground capitalize">{role}</span>
                </p>
                {expiresAt && (
                  <p>
                    Expires: <span className="text-foreground">{formatExpiration(expiresAt)}</span>
                  </p>
                )}
                <p className="text-xs mt-2">
                  This code can only be used once. Share it with the person you want to invite.
                </p>
              </div>

              {/* Generate Another */}
              <button
                onClick={() => {
                  setInviteCode(null);
                  setExpiresAt(null);
                }}
                className="w-full py-2 px-4 border border-border hover:bg-muted transition-colors text-sm"
              >
                Generate Another Code
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-border hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
