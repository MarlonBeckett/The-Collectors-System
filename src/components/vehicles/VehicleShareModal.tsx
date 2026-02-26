'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { VehicleShareLink, ShareLinkToggles } from '@/types/database';
import { VisibilityToggles, VisibilityBadges, DEFAULT_TOGGLES, TOGGLE_LABELS } from '@/components/share/VisibilityToggles';

interface VehicleShareModalProps {
  motorcycleId: string;
  vehicleName: string;
  onClose: () => void;
}

export function VehicleShareModal({ motorcycleId, vehicleName, onClose }: VehicleShareModalProps) {
  const [shareLinks, setShareLinks] = useState<VehicleShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [newToggles, setNewToggles] = useState<ShareLinkToggles>({ ...DEFAULT_TOGGLES });
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [togglingLink, setTogglingLink] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingVisibilityId, setEditingVisibilityId] = useState<string | null>(null);
  const [editingToggles, setEditingToggles] = useState<ShareLinkToggles>({ ...DEFAULT_TOGGLES });
  const [savingVisibility, setSavingVisibility] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLinks() {
      const { data } = await supabase
        .from('vehicle_share_links')
        .select('*')
        .eq('motorcycle_id', motorcycleId)
        .order('created_at', { ascending: false });

      setShareLinks((data || []) as VehicleShareLink[]);
      setLoading(false);
    }
    fetchLinks();
  }, [motorcycleId, supabase]);

  const createShareLink = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/vehicles/share-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorcycleId,
          name: newLinkName.trim() || undefined,
          ...newToggles,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const { data: newLink } = await supabase
          .from('vehicle_share_links')
          .select('*')
          .eq('id', data.id)
          .single();

        if (newLink) {
          setShareLinks(prev => [newLink as VehicleShareLink, ...prev]);
        }
        setNewLinkName('');
        setNewToggles({ ...DEFAULT_TOGGLES });
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleShareLink = async (linkId: string, currentActive: boolean) => {
    setTogglingLink(linkId);
    try {
      const response = await fetch(`/api/vehicles/share-link/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });

      if (response.ok) {
        setShareLinks(links =>
          links.map(l => l.id === linkId ? { ...l, is_active: !currentActive } : l)
        );
      }
    } finally {
      setTogglingLink(null);
    }
  };

  const deleteShareLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this share link? This cannot be undone.')) {
      return;
    }

    setDeletingLink(linkId);
    try {
      const response = await fetch(`/api/vehicles/share-link/${linkId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShareLinks(links => links.filter(l => l.id !== linkId));
      }
    } finally {
      setDeletingLink(null);
    }
  };

  const copyShareUrl = async (token: string, linkId: string) => {
    const url = `${window.location.origin}/share/vehicle/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const startEditingName = (link: VehicleShareLink) => {
    setEditingLinkId(link.id);
    setEditingName(link.name || '');
  };

  const saveLinkName = async (linkId: string) => {
    setSavingName(true);
    try {
      const response = await fetch(`/api/vehicles/share-link/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      if (response.ok) {
        setShareLinks(links =>
          links.map(l => l.id === linkId ? { ...l, name: editingName.trim() || null } : l)
        );
      }
    } finally {
      setSavingName(false);
      setEditingLinkId(null);
    }
  };

  const startEditingVisibility = (link: VehicleShareLink) => {
    setEditingVisibilityId(link.id);
    const toggles: ShareLinkToggles = {} as ShareLinkToggles;
    for (const { key } of TOGGLE_LABELS) {
      toggles[key] = link[key];
    }
    setEditingToggles(toggles);
  };

  const saveVisibility = async (linkId: string) => {
    setSavingVisibility(true);
    try {
      const response = await fetch(`/api/vehicles/share-link/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingToggles),
      });

      if (response.ok) {
        setShareLinks(links =>
          links.map(l => l.id === linkId ? { ...l, ...editingToggles } : l)
        );
      }
    } finally {
      setSavingVisibility(false);
      setEditingVisibilityId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">Share Vehicle</h2>
            <p className="text-sm text-muted-foreground truncate">{vehicleName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Create section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Create New Link</h3>
            <input
              type="text"
              value={newLinkName}
              onChange={(e) => setNewLinkName(e.target.value)}
              placeholder="Link name (optional)"
              className="w-full px-3 py-2 border border-border bg-background text-sm focus:outline-none focus:border-primary"
              maxLength={100}
            />
            <VisibilityToggles
              values={newToggles}
              onChange={(key, value) => setNewToggles(prev => ({ ...prev, [key]: value }))}
            />
            <button
              onClick={createShareLink}
              disabled={creating}
              className="w-full py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Share Link'}
            </button>
          </div>

          {/* Info text */}
          <p className="text-xs text-muted-foreground">
            Photos, year/make/model, nickname, vehicle type, status, and sale info are always shown. Toggle other fields above.
          </p>

          {/* Existing links */}
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : shareLinks.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Existing Links</h3>
              <div className="space-y-3">
                {shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className="py-2 px-2 bg-muted/50 rounded space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {editingLinkId === link.id ? (
                          <form
                            onSubmit={(e) => { e.preventDefault(); saveLinkName(link.id); }}
                            className="flex items-center gap-1"
                          >
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              placeholder="Link name"
                              className="w-full text-sm px-2 py-1 border border-border bg-background focus:outline-none focus:border-primary"
                              maxLength={100}
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Escape') setEditingLinkId(null); }}
                            />
                            <button
                              type="submit"
                              disabled={savingName}
                              className="p-1 hover:bg-muted rounded transition-colors shrink-0"
                              title="Save"
                            >
                              <CheckIcon className="w-4 h-4 text-secondary" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLinkId(null)}
                              className="p-1 hover:bg-muted rounded transition-colors shrink-0"
                              title="Cancel"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">
                              {link.name || <span className="text-muted-foreground italic">Unnamed</span>}
                            </span>
                            <button
                              onClick={() => startEditingName(link)}
                              className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
                              title="Edit name"
                            >
                              <PencilIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        )}
                        <div className="text-xs font-mono truncate text-muted-foreground">
                          /share/vehicle/{link.token.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                          link.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {link.is_active ? 'active' : 'disabled'}
                      </span>
                      {link.last_accessed_at && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          Viewed {new Date(link.last_accessed_at).toLocaleDateString()}
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => editingVisibilityId === link.id ? setEditingVisibilityId(null) : startEditingVisibility(link)}
                        className="text-xs px-2 py-1 border border-border hover:bg-muted rounded transition-colors shrink-0 flex items-center gap-1"
                      >
                        <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                        Visibility
                      </button>
                      <button
                        onClick={() => copyShareUrl(link.token, link.id)}
                        className="p-1.5 hover:bg-muted rounded transition-colors shrink-0"
                        title="Copy link"
                      >
                        {copiedLinkId === link.id ? (
                          <CheckIcon className="w-4 h-4 text-secondary" />
                        ) : (
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleShareLink(link.id, link.is_active)}
                        disabled={togglingLink === link.id}
                        className="text-xs px-2 py-1 border border-border hover:bg-muted rounded transition-colors disabled:opacity-50 shrink-0"
                      >
                        {link.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteShareLink(link.id)}
                        disabled={deletingLink === link.id}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 shrink-0"
                        title="Delete link"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Visibility badges */}
                    {editingVisibilityId !== link.id && (
                      <VisibilityBadges values={link} />
                    )}
                    {/* Inline visibility editor */}
                    {editingVisibilityId === link.id && (
                      <div className="pt-2 border-t border-border space-y-2">
                        <VisibilityToggles
                          values={editingToggles}
                          onChange={(key, value) => setEditingToggles(prev => ({ ...prev, [key]: value }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveVisibility(link.id)}
                            disabled={savingVisibility}
                            className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 rounded"
                          >
                            {savingVisibility ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingVisibilityId(null)}
                            className="flex-1 py-1.5 border border-border text-xs hover:bg-muted rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2 border border-border hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
