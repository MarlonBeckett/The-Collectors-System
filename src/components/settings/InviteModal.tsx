'use client';

import { useState } from 'react';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

interface InviteModalProps {
  collectionId: string;
  userRole: string;
  onClose: () => void;
}

type InviteRole = 'editor' | 'viewer' | 'quick_view';

export function InviteModal({ collectionId, userRole, onClose }: InviteModalProps) {
  const isOwner = userRole === 'owner';
  const [role, setRole] = useState<InviteRole>(isOwner ? 'editor' : 'quick_view');
  const [linkName, setLinkName] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInvite = async () => {
    setGenerating(true);
    setError(null);

    try {
      if (role === 'quick_view') {
        // Create a share link instead of an invite code
        const response = await fetch('/api/collections/share-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionId, ...(linkName.trim() ? { name: linkName.trim() } : {}) }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to generate share link');
          return;
        }

        setShareUrl(data.shareUrl);
      } else {
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
      }
    } catch {
      setError('Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
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

  const resetState = () => {
    setInviteCode(null);
    setShareUrl(null);
    setExpiresAt(null);
    setCopied(false);
    setLinkName('');
  };

  const hasResult = inviteCode || shareUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border w-full max-w-lg">
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
          {!hasResult ? (
            <>
              {/* Role Selection */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  {isOwner ? 'Select Role' : 'Share Type'}
                </label>
                <div className={`grid gap-2 ${isOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {isOwner && (
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
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Requires Pro subscription
                      </div>
                    </button>
                  )}
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
                  <button
                    onClick={() => setRole('quick_view')}
                    className={`p-3 border text-left transition-colors ${
                      role === 'quick_view'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Quick View
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Anyone with the link can view — no login required
                    </div>
                  </button>
                </div>
              </div>

              {role === 'quick_view' && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Link Name <span className="text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="e.g. For Instagram, For Dad"
                    className="w-full px-3 py-2 border border-border bg-background text-sm focus:outline-none focus:border-primary"
                    maxLength={100}
                  />
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateInvite}
                disabled={generating}
                className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {generating
                  ? 'Generating...'
                  : role === 'quick_view'
                    ? 'Generate Share Link'
                    : 'Generate Invite Code'}
              </button>
            </>
          ) : shareUrl ? (
            <>
              {/* Share URL Display */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Share Link
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted px-3 py-3 font-mono text-sm truncate">
                    {shareUrl}
                  </div>
                  <button
                    onClick={() => copyToClipboard(shareUrl)}
                    className="p-3 border border-border hover:bg-muted transition-colors shrink-0"
                    title="Copy link"
                  >
                    {copied ? (
                      <CheckIcon className="w-5 h-5 text-secondary" />
                    ) : (
                      <ClipboardDocumentIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Access: <span className="text-foreground">Read-only (no login required)</span>
                </p>
                <p className="text-xs mt-2">
                  This link doesn&apos;t expire. You can disable it anytime from the Members panel.
                </p>
                <p className="text-xs">
                  Sensitive info (VIN, plate, price) is hidden from anonymous viewers.
                </p>
              </div>

              <button
                onClick={resetState}
                className="w-full py-2 px-4 border border-border hover:bg-muted transition-colors text-sm"
              >
                Generate Another Link
              </button>
            </>
          ) : (
            <>
              {/* Generated Invite Code Display */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Invite Code
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted px-4 py-3 font-mono text-xl tracking-widest text-center">
                    {inviteCode}
                  </div>
                  <button
                    onClick={() => copyToClipboard(inviteCode!)}
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

              <button
                onClick={resetState}
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
