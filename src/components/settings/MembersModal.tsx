'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { XMarkIcon, UserMinusIcon } from '@heroicons/react/24/outline';

interface Member {
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  isCurrentUser: boolean;
}

interface MembersModalProps {
  collectionId: string;
  collectionName: string;
  isOwner: boolean;
  onClose: () => void;
  onMemberRemoved: () => void;
}

export function MembersModal({
  collectionId,
  collectionName,
  isOwner,
  onClose,
  onMemberRemoved,
}: MembersModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchMembers() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Fetch members first
      const { data: membersData, error: membersError } = await supabase
        .from('collection_members')
        .select('user_id, role')
        .eq('collection_id', collectionId);

      if (membersError || !membersData) {
        setLoading(false);
        return;
      }

      // Fetch profiles for all member user_ids
      const userIds = membersData.map((m) => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);

      // Create a map of user_id to profile
      const profileMap = new Map(
        (profilesData || []).map((p) => [p.id, p])
      );

      // Combine members with profiles
      const formatted = membersData
        .map((m) => {
          const profile = profileMap.get(m.user_id);
          return {
            user_id: m.user_id,
            role: m.role,
            email: profile?.email || null,
            display_name: profile?.display_name || null,
            isCurrentUser: m.user_id === currentUserId,
          };
        })
        // Sort: owner first, then current user, then others
        .sort((a, b) => {
          if (a.role === 'owner') return -1;
          if (b.role === 'owner') return 1;
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return 0;
        });
      setMembers(formatted);
      setLoading(false);
    }

    fetchMembers();
  }, [collectionId, supabase]);

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
                        : member.display_name || member.email?.split('@')[0] || 'Unknown'}
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
