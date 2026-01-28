'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Collection, CollectionMember } from '@/types/database';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  UserMinusIcon,
  CheckIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface CollectionSettingsProps {
  collection: Collection;
  members: (CollectionMember & { email?: string })[];
  isOwner: boolean;
  onUpdate: () => void;
  totalCollections: number;
}

export function CollectionSettings({
  collection,
  members,
  isOwner,
  onUpdate,
  totalCollections,
}: CollectionSettingsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [joinCode, setJoinCode] = useState(collection.join_code);
  const [leaving, setLeaving] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [collectionName, setCollectionName] = useState(collection.name);
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  const canDelete = isOwner && totalCollections > 1;

  const handleSaveName = async () => {
    if (!collectionName.trim() || collectionName.trim() === collection.name) {
      setEditingName(false);
      setCollectionName(collection.name);
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('collections')
        .update({ name: collectionName.trim() })
        .eq('id', collection.id);

      if (!error) {
        setEditingName(false);
        router.refresh();
      }
    } finally {
      setSavingName(false);
    }
  };

  const copyJoinCode = async () => {
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateCode = async () => {
    if (!isOwner) return;

    setRegenerating(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let newCode = '';
      for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { error } = await supabase
        .from('collections')
        .update({ join_code: newCode })
        .eq('id', collection.id);

      if (!error) {
        setJoinCode(newCode);
      }
    } finally {
      setRegenerating(false);
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

  const removeMember = async (memberId: string) => {
    if (!isOwner) return;

    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setRemovingMember(memberId);
    try {
      await supabase
        .from('collection_members')
        .delete()
        .eq('collection_id', collection.id)
        .eq('user_id', memberId);

      onUpdate();
    } finally {
      setRemovingMember(null);
    }
  };

  const deleteCollection = async () => {
    if (!canDelete) return;

    const confirmMessage = `Are you sure you want to delete "${collectionName}"? This will permanently delete all vehicles in this collection. This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    // Double confirmation for destructive action
    const typedName = prompt(`Type "${collectionName}" to confirm deletion:`);
    if (typedName !== collectionName) {
      alert('Collection name did not match. Deletion cancelled.');
      return;
    }

    setDeleting(true);
    try {
      // Delete all vehicles in the collection first
      await supabase
        .from('motorcycles')
        .delete()
        .eq('collection_id', collection.id);

      // Delete all collection members
      await supabase
        .from('collection_members')
        .delete()
        .eq('collection_id', collection.id);

      // Delete the collection itself
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collection.id);

      if (!error) {
        onUpdate();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-card border border-border overflow-hidden">
      {/* Collection Header */}
      <div className="px-4 py-3 bg-muted/50 border-b border-border">
        {editingName && isOwner ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Collection name"
              className="flex-1 px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring font-semibold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditingName(false);
                  setCollectionName(collection.name);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveName}
                disabled={savingName || !collectionName.trim()}
                className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setCollectionName(collection.name);
                }}
                className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-3 py-1.5 border border-border text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{collectionName}</h3>
              {isOwner && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Rename collection"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {isOwner ? 'Owner' : 'Member'}
            </span>
          </div>
        )}
      </div>

      {/* Share Access */}
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Share Access</h4>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted p-2.5 font-mono text-xl text-center tracking-widest">
            {joinCode}
          </div>
          <button
            onClick={copyJoinCode}
            className="p-2.5 border border-border hover:bg-muted transition-colors"
            title="Copy code"
          >
            {copied ? (
              <CheckIcon className="w-5 h-5 text-secondary" />
            ) : (
              <ClipboardDocumentIcon className="w-5 h-5" />
            )}
          </button>
          {isOwner && (
            <button
              onClick={regenerateCode}
              disabled={regenerating}
              className="p-2.5 border border-border hover:bg-muted transition-colors disabled:opacity-50"
              title="Generate new code"
            >
              <ArrowPathIcon
                className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
        {isOwner && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Regenerating the code will invalidate the old one
          </p>
        )}
      </div>

      {/* Members */}
      <div className="px-4 py-3">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Members ({members.length})
        </h4>

        {members.length > 0 ? (
          <div className="space-y-1">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
              >
                <div>
                  <span className="text-sm">
                    {member.email || 'Unknown user'}
                  </span>
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      member.role === 'owner'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>

                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => removeMember(member.user_id)}
                    disabled={removingMember === member.user_id}
                    className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                    title="Remove member"
                  >
                    <UserMinusIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No members yet. Share the code above to invite people.</p>
        )}
      </div>

      {/* Leave Collection (non-owners only) */}
      {!isOwner && (
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={leaveCollection}
            disabled={leaving}
            className="text-destructive hover:underline text-sm disabled:opacity-50"
          >
            {leaving ? 'Leaving...' : 'Leave this collection'}
          </button>
        </div>
      )}

      {/* Delete Collection (owners only) */}
      {isOwner && (
        <div className="px-4 py-3 border-t border-border">
          {canDelete ? (
            <button
              onClick={deleteCollection}
              disabled={deleting}
              className="text-destructive hover:underline text-sm disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete this collection'}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              You cannot delete your only collection. Create or join another collection first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
