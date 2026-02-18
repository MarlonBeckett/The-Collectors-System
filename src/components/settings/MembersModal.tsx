'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  XMarkIcon,
  UserMinusIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { CollectionShareLink } from '@/types/database';

interface Member {
  user_id: string;
  role: string;
  intended_role: string | null;
  email: string | null;
  username: string | null;
  isCurrentUser: boolean;
}

interface MembersModalProps {
  collectionId: string;
  collectionName: string;
  isOwner: boolean;
  userRole: string;
  onClose: () => void;
  onMemberRemoved: () => void;
}

export function MembersModal({
  collectionId,
  collectionName,
  isOwner,
  userRole,
  onClose,
  onMemberRemoved,
}: MembersModalProps) {
  const canManageLinks = isOwner || userRole === 'editor';
  const [members, setMembers] = useState<Member[]>([]);
  const [shareLinks, setShareLinks] = useState<CollectionShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [togglingLink, setTogglingLink] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('collection_members')
        .select('user_id, role, intended_role')
        .eq('collection_id', collectionId);

      if (membersError || !membersData) {
        setLoading(false);
        return;
      }

      // Fetch profiles for all member user_ids
      const userIds = membersData.map((m) => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, username')
        .in('id', userIds);

      const profileMap = new Map(
        (profilesData || []).map((p) => [p.id, p])
      );

      const formatted = membersData
        .map((m) => {
          const profile = profileMap.get(m.user_id);
          return {
            user_id: m.user_id,
            role: m.role,
            intended_role: m.intended_role || null,
            email: profile?.email || null,
            username: profile?.username || null,
            isCurrentUser: m.user_id === currentUserId,
          };
        })
        .sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return 0;
        });
      setMembers(formatted);

      // Fetch share links (owner and editors)
      if (canManageLinks) {
        const { data: linksData } = await supabase
          .from('collection_share_links')
          .select('*')
          .eq('collection_id', collectionId)
          .order('created_at', { ascending: false });

        setShareLinks((linksData || []) as CollectionShareLink[]);
      }

      setLoading(false);
    }

    fetchData();
  }, [collectionId, supabase, canManageLinks]);

  const removeMember = async (memberId: string) => {
    if (!isOwner) return;

    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setRemovingMember(memberId);
    try {
      const { error } = await supabase
        .from('collection_members')
        .delete()
        .eq('collection_id', collectionId)
        .eq('user_id', memberId);

      if (!error) {
        setMembers(members.filter((m) => m.user_id !== memberId));
        onMemberRemoved();
      }
    } finally {
      setRemovingMember(null);
    }
  };

  const toggleShareLink = async (linkId: string, currentActive: boolean) => {
    setTogglingLink(linkId);
    try {
      const response = await fetch(`/api/collections/share-link/${linkId}`, {
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
      const response = await fetch(`/api/collections/share-link/${linkId}`, {
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
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const startEditingName = (link: CollectionShareLink) => {
    setEditingLinkId(link.id);
    setEditingName(link.name || '');
  };

  const saveLinkName = async (linkId: string) => {
    setSavingName(true);
    try {
      const response = await fetch(`/api/collections/share-link/${linkId}`, {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">{collectionName}</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No members</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-3 px-2 border-b border-border last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {member.isCurrentUser
                        ? 'You'
                        : member.username || member.email?.split('@')[0] || 'Unknown'}
                    </div>
                    {member.email && !member.isCurrentUser && (
                      <div className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        member.role === 'owner'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {member.role}
                    </span>
                    {member.intended_role === 'editor' && member.role === 'viewer' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        pending editor
                      </span>
                    )}
                    {isOwner && member.role !== 'owner' && (
                      <button
                        onClick={() => removeMember(member.user_id)}
                        disabled={removingMember === member.user_id}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                        title="Remove member"
                      >
                        <UserMinusIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Share Links Section (owner and editors) */}
          {canManageLinks && !loading && shareLinks.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Share Links</h3>
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
                          /share/{link.token.slice(0, 8)}...
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                          link.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {link.is_active ? 'active' : 'disabled'}
                      </span>
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
