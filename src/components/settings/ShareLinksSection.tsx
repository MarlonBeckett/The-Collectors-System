'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  LinkIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { CollectionShareLink, VehicleShareLink, ShareLinkToggles } from '@/types/database';
import { VisibilityToggles, VisibilityBadges, TOGGLE_LABELS } from '@/components/share/VisibilityToggles';

interface UserCollection {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  owner_display_name: string | null;
  is_owner: boolean;
  role: string;
  member_count: number;
}

interface VehicleShareLinkWithVehicle extends VehicleShareLink {
  vehicle_name: string;
  vehicle_id: string;
  collection_id: string;
}

interface CollectionGroup {
  collection: UserCollection;
  collectionLinks: CollectionShareLink[];
  vehicleLinks: VehicleShareLinkWithVehicle[];
}

interface ShareLinksSectionProps {
  collections: UserCollection[];
}

export function ShareLinksSection({ collections }: ShareLinksSectionProps) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [groups, setGroups] = useState<CollectionGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Editing state
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingVisibilityId, setEditingVisibilityId] = useState<string | null>(null);
  const [editingToggles, setEditingToggles] = useState<ShareLinkToggles>({} as ShareLinkToggles);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [togglingLink, setTogglingLink] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);

  const accessibleCollections = collections.filter(c => c.is_owner || c.role === 'editor');
  const accessibleIds = accessibleCollections.map(c => c.id);

  // Fetch on first expand (lazy load)
  useEffect(() => {
    if (!expanded || fetched) return;
    if (accessibleIds.length === 0) {
      setLoading(false);
      setFetched(true);
      return;
    }

    async function fetchLinks() {
      try {
        const [collectionRes, vehicleRes] = await Promise.all([
          supabase
            .from('collection_share_links')
            .select('*')
            .in('collection_id', accessibleIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('vehicle_share_links')
            .select('*, motorcycles!inner(id, make, model, year, nickname, collection_id)')
            .in('motorcycles.collection_id', accessibleIds)
            .order('created_at', { ascending: false }),
        ]);

        const collectionLinks = (collectionRes.data || []) as CollectionShareLink[];
        const vehicleLinksRaw = (vehicleRes.data || []) as (VehicleShareLink & {
          motorcycles: { id: string; make: string; model: string; year: number; nickname: string | null; collection_id: string };
        })[];

        const vehicleLinks: VehicleShareLinkWithVehicle[] = vehicleLinksRaw.map(vl => {
          const v = vl.motorcycles;
          const name = v.nickname || `${v.year} ${v.make} ${v.model}`;
          return {
            ...vl,
            vehicle_name: name,
            vehicle_id: v.id,
            collection_id: v.collection_id,
          };
        });

        setTotalCount(collectionLinks.length + vehicleLinks.length);

        const grouped: CollectionGroup[] = accessibleCollections
          .map(collection => ({
            collection,
            collectionLinks: collectionLinks.filter(l => l.collection_id === collection.id),
            vehicleLinks: vehicleLinks.filter(l => l.collection_id === collection.id),
          }))
          .filter(g => g.collectionLinks.length > 0 || g.vehicleLinks.length > 0);

        setGroups(grouped);
      } catch {
        setError('Failed to load share links');
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }

    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // --- Actions ---

  const copyUrl = async (token: string, linkId: string, type: 'collection' | 'vehicle') => {
    const path = type === 'collection' ? `/share/${token}` : `/share/vehicle/${token}`;
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const toggleActive = async (linkId: string, currentActive: boolean, type: 'collection' | 'vehicle') => {
    setTogglingLink(linkId);
    try {
      const endpoint = type === 'collection'
        ? `/api/collections/share-link/${linkId}`
        : `/api/vehicles/share-link/${linkId}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (response.ok) {
        setGroups(prev => prev.map(g => ({
          ...g,
          collectionLinks: g.collectionLinks.map(l => l.id === linkId ? { ...l, is_active: !currentActive } : l),
          vehicleLinks: g.vehicleLinks.map(l => l.id === linkId ? { ...l, is_active: !currentActive } : l),
        })));
      }
    } finally {
      setTogglingLink(null);
    }
  };

  const deleteLink = async (linkId: string, type: 'collection' | 'vehicle') => {
    if (!confirm('Are you sure you want to delete this share link? This cannot be undone.')) return;
    setDeletingLink(linkId);
    try {
      const endpoint = type === 'collection'
        ? `/api/collections/share-link/${linkId}`
        : `/api/vehicles/share-link/${linkId}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (response.ok) {
        setTotalCount(prev => prev - 1);
        setGroups(prev => prev.map(g => ({
          ...g,
          collectionLinks: g.collectionLinks.filter(l => l.id !== linkId),
          vehicleLinks: g.vehicleLinks.filter(l => l.id !== linkId),
        })).filter(g => g.collectionLinks.length > 0 || g.vehicleLinks.length > 0));
      }
    } finally {
      setDeletingLink(null);
    }
  };

  const startEditingName = (id: string, currentName: string | null) => {
    setEditingNameId(id);
    setEditingNameValue(currentName || '');
  };

  const saveName = async (linkId: string, type: 'collection' | 'vehicle') => {
    setSavingName(true);
    try {
      const endpoint = type === 'collection'
        ? `/api/collections/share-link/${linkId}`
        : `/api/vehicles/share-link/${linkId}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingNameValue }),
      });
      if (response.ok) {
        const newName = editingNameValue.trim() || null;
        setGroups(prev => prev.map(g => ({
          ...g,
          collectionLinks: g.collectionLinks.map(l => l.id === linkId ? { ...l, name: newName } : l),
          vehicleLinks: g.vehicleLinks.map(l => l.id === linkId ? { ...l, name: newName } : l),
        })));
      }
    } finally {
      setSavingName(false);
      setEditingNameId(null);
    }
  };

  const startEditingVisibility = (link: CollectionShareLink | VehicleShareLink) => {
    setEditingVisibilityId(link.id);
    const toggles: ShareLinkToggles = {} as ShareLinkToggles;
    for (const { key } of TOGGLE_LABELS) {
      toggles[key] = link[key];
    }
    setEditingToggles(toggles);
  };

  const saveVisibility = async (linkId: string, type: 'collection' | 'vehicle') => {
    setSavingVisibility(true);
    try {
      const endpoint = type === 'collection'
        ? `/api/collections/share-link/${linkId}`
        : `/api/vehicles/share-link/${linkId}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingToggles),
      });
      if (response.ok) {
        setGroups(prev => prev.map(g => ({
          ...g,
          collectionLinks: g.collectionLinks.map(l => l.id === linkId ? { ...l, ...editingToggles } : l),
          vehicleLinks: g.vehicleLinks.map(l => l.id === linkId ? { ...l, ...editingToggles } : l),
        })));
      }
    } finally {
      setSavingVisibility(false);
      setEditingVisibilityId(null);
    }
  };

  // --- Render helpers ---

  function renderLinkItem(
    link: CollectionShareLink | VehicleShareLinkWithVehicle,
    type: 'collection' | 'vehicle',
  ) {
    const token = link.token;
    const pathPrefix = type === 'collection' ? '/share/' : '/share/vehicle/';

    return (
      <div key={link.id} className="py-2 px-2 bg-muted/50 rounded space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {editingNameId === link.id ? (
              <form
                onSubmit={(e) => { e.preventDefault(); saveName(link.id, type); }}
                className="flex items-center gap-1"
              >
                <input
                  type="text"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  placeholder="Link name"
                  className="w-full text-sm px-2 py-1 border border-border bg-background focus:outline-none focus:border-primary"
                  maxLength={100}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingNameId(null); }}
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
                  onClick={() => setEditingNameId(null)}
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
                  onClick={() => startEditingName(link.id, link.name)}
                  className="p-0.5 hover:bg-muted rounded transition-colors shrink-0"
                  title="Edit name"
                >
                  <PencilIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}
            <div className="text-xs font-mono truncate text-muted-foreground">
              {pathPrefix}{token.slice(0, 8)}...
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
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {type === 'collection' ? 'collection' : 'vehicle'}
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
            onClick={() => copyUrl(token, link.id, type)}
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
            onClick={() => toggleActive(link.id, link.is_active, type)}
            disabled={togglingLink === link.id}
            className="text-xs px-2 py-1 border border-border hover:bg-muted rounded transition-colors disabled:opacity-50 shrink-0"
          >
            {link.is_active ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => deleteLink(link.id, type)}
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
                onClick={() => saveVisibility(link.id, type)}
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
    );
  }

  // --- Main render ---

  return (
    <section>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between bg-card border border-border px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <LinkIcon className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="text-left">
            <span className="font-semibold text-sm">Share Links</span>
            {fetched && (
              <span className="ml-2 text-xs text-muted-foreground">
                {totalCount === 0 ? 'None' : totalCount}
              </span>
            )}
          </div>
        </div>
        <ChevronRightIcon
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border border-t-0 border-border bg-card">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-10 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                No share links yet. Create them from a collection&apos;s Share panel or a vehicle&apos;s share button.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {groups.map(({ collection, collectionLinks, vehicleLinks }) => (
                <div key={collection.id}>
                  <div className="px-4 py-2.5 bg-muted/30">
                    <h3 className="font-medium text-sm">{collection.name}</h3>
                  </div>
                  <div className="p-3 space-y-3">
                    {collectionLinks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Collection Links</p>
                        {collectionLinks.map(link => renderLinkItem(link, 'collection'))}
                      </div>
                    )}
                    {vehicleLinks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicle Links</p>
                        {Object.entries(
                          vehicleLinks.reduce<Record<string, VehicleShareLinkWithVehicle[]>>((acc, vl) => {
                            const key = vl.vehicle_id;
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(vl);
                            return acc;
                          }, {})
                        ).map(([vehicleId, links]) => (
                          <div key={vehicleId} className="space-y-1.5">
                            <p className="text-sm font-medium text-foreground/80 pl-1">{links[0].vehicle_name}</p>
                            {links.map(link => renderLinkItem(link, 'vehicle'))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
