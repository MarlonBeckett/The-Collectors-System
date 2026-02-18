'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Collection } from '@/types/database';
import { MembersModal } from './MembersModal';
import { InviteModal } from './InviteModal';
import {
  UserPlusIcon,
  TrashIcon,
  ChevronRightIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface CollectionSettingsProps {
  collection: Collection;
  memberCount: number;
  isOwner: boolean;
  userRole: string;
  onUpdate: () => void;
}

export function CollectionSettings({
  collection,
  memberCount,
  isOwner,
  userRole,
  onUpdate,
}: CollectionSettingsProps) {
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [currentMemberCount, setCurrentMemberCount] = useState(memberCount);

  // Rename state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === collection.name) {
      setEditName(collection.name);
      setEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await supabase
        .from('collections')
        .update({ name: trimmed })
        .eq('id', collection.id);

      setEditingName(false);
      onUpdate();
    } finally {
      setSavingName(false);
    }
  };

  const leaveCollection = async () => {
    if (isOwner) return;

    if (!confirm('Are you sure you want to leave this collection? You will lose access to all vehicles in this collection.')) {
      return;
    }

    setLeaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('collection_members')
        .delete()
        .eq('collection_id', collection.id)
        .eq('user_id', user.id);

      onUpdate();
    } finally {
      setLeaving(false);
    }
  };

  const deleteCollection = async () => {
    if (!isOwner) return;

    const confirmed = confirm(
      'WARNING: This will permanently delete this collection and ALL vehicles in it. This cannot be undone.\n\nAre you absolutely sure you want to delete this collection?'
    );

    if (!confirmed) return;

    const doubleConfirmed = confirm(
      `Type of confirm: You are about to delete "${collection.name}" and all its vehicles. Continue?`
    );

    if (!doubleConfirmed) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/collections/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: collection.id }),
      });

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete collection');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleMemberRemoved = () => {
    setCurrentMemberCount((prev) => Math.max(0, prev - 1));
    onUpdate();
  };

  return (
    <>
      <div className="bg-card border border-border overflow-hidden">
        {/* Header: Name + Member Count */}
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') { setEditName(collection.name); setEditingName(false); }
                  }}
                  className="flex-1 px-2 py-1 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={100}
                  disabled={savingName}
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !editName.trim()}
                  className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditName(collection.name); setEditingName(false); }}
                  className="px-2 py-1 text-xs border border-border hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-lg truncate">{collection.name}</h3>
                {isOwner && (
                  <button
                    onClick={() => { setEditName(collection.name); setEditingName(true); }}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Edit collection name"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {isOwner && !editingName && (
              <span className="text-xs text-muted-foreground">Owner</span>
            )}
          </div>
          {(isOwner || userRole === 'editor') && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <span>{currentMemberCount} member{currentMemberCount !== 1 ? 's' : ''}</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Invite Member Button - Visible to owners and editors */}
        {(isOwner || userRole === 'editor') && (
          <div className="px-4 pb-4 border-t border-border pt-4">
            <button
              onClick={() => setShowInviteModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-border hover:bg-muted transition-colors"
            >
              <UserPlusIcon className="w-5 h-5" />
              <span>{isOwner ? 'Invite Member' : 'Share Collection'}</span>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 pb-4 flex justify-between items-center">
          {isOwner ? (
            <button
              onClick={deleteCollection}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm text-destructive hover:underline disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete collection'}
            </button>
          ) : (
            <button
              onClick={leaveCollection}
              disabled={leaving}
              className="text-sm text-destructive hover:underline disabled:opacity-50"
            >
              {leaving ? 'Leaving...' : 'Leave collection'}
            </button>
          )}
        </div>
      </div>

      {/* Members Modal */}
      {showMembersModal && (
        <MembersModal
          collectionId={collection.id}
          collectionName={collection.name}
          isOwner={isOwner}
          userRole={userRole}
          onClose={() => setShowMembersModal(false)}
          onMemberRemoved={handleMemberRemoved}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          collectionId={collection.id}
          userRole={userRole}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </>
  );
}
