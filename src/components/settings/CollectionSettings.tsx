'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Collection, CollectionMember } from '@/types/database';
import {
  ClipboardDocumentIcon,
  ArrowPathIcon,
  UserMinusIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface CollectionSettingsProps {
  collection: Collection;
  members: (CollectionMember & { email?: string })[];
  isOwner: boolean;
  onUpdate: () => void;
}

export function CollectionSettings({
  collection,
  members,
  isOwner,
  onUpdate,
}: CollectionSettingsProps) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [joinCode, setJoinCode] = useState(collection.join_code);
  const [leaving, setLeaving] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const supabase = createClient();

  const copyJoinCode = async () => {
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateCode = async () => {
    if (!isOwner) return;

    setRegenerating(true);
    try {
      // Generate new code
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

  const otherMembers = members.filter((m) => m.role !== 'owner');

  return (
    <div className="space-y-6">
      {/* Collection Info */}
      <div className="bg-card border border-border p-4">
        <h3 className="font-semibold mb-1">{collection.name}</h3>
        <p className="text-sm text-muted-foreground">
          {isOwner ? 'You are the owner' : 'You are a member'}
        </p>
      </div>

      {/* Join Code */}
      <div className="bg-card border border-border p-4">
        <h3 className="font-semibold mb-2">Share Access</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Share this code with others to give them access to your collection
        </p>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted p-3 font-mono text-2xl text-center tracking-widest">
            {joinCode}
          </div>
          <button
            onClick={copyJoinCode}
            className="p-3 border border-border hover:bg-muted transition-colors"
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
              className="p-3 border border-border hover:bg-muted transition-colors disabled:opacity-50"
              title="Generate new code"
            >
              <ArrowPathIcon
                className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>

        {isOwner && (
          <p className="text-xs text-muted-foreground mt-2">
            Regenerating the code will invalidate the old one
          </p>
        )}
      </div>

      {/* Members */}
      <div className="bg-card border border-border p-4">
        <h3 className="font-semibold mb-2">
          Members ({members.length})
        </h3>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
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
      </div>

      {/* Leave Collection (non-owners only) */}
      {!isOwner && (
        <div className="pt-4 border-t border-border">
          <button
            onClick={leaveCollection}
            disabled={leaving}
            className="text-destructive hover:underline text-sm disabled:opacity-50"
          >
            {leaving ? 'Leaving...' : 'Leave this collection'}
          </button>
        </div>
      )}
    </div>
  );
}
