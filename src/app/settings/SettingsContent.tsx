'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/database';
import { CollectionSettings } from '@/components/settings/CollectionSettings';
import { JoinCollection } from '@/components/settings/JoinCollection';
import SubscriptionSettings from '@/components/settings/SubscriptionSettings';
import DangerZone from '@/components/settings/DangerZone';
import { createClient } from '@/lib/supabase/client';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, PlusIcon, PencilIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { Subscription } from '@/lib/subscription';

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

interface SettingsContentProps {
  user: User;
  profile: Profile | null;
  collections: UserCollection[];
  subscription: Subscription | null;
  vehicleCount: number;
}

export function SettingsContent({
  user,
  profile,
  collections,
  subscription,
  vehicleCount,
}: SettingsContentProps) {
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleUpdate = () => {
    router.refresh();
  };

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) return;

    setSavingDisplayName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id);

      if (!error) {
        setEditingDisplayName(false);
        router.refresh();
      }
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/collections/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });

      if (response.ok) {
        setNewCollectionName('');
        setShowCreateForm(false);
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  };

  // Separate owned and joined collections
  const ownedCollections = collections.filter((c) => c.is_owner);
  const joinedCollections = collections.filter((c) => !c.is_owner);

  return (
    <div className="space-y-8">
      {/* Subscription Section */}
      <section>
        <SubscriptionSettings subscription={subscription} vehicleCount={vehicleCount} />
      </section>

      {/* Account Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <div className="bg-card border border-border p-4 space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Display Name</label>
            {editingDisplayName ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter display name"
                  className="flex-1 px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDisplayName}
                    disabled={savingDisplayName || !displayName.trim()}
                    className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {savingDisplayName ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingDisplayName(false);
                      setDisplayName(profile?.display_name || '');
                    }}
                    className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-3 py-1.5 border border-border text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-medium">{profile?.display_name || 'Not set'}</p>
                <button
                  onClick={() => setEditingDisplayName(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* My Collections Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">My Collections</h2>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <PlusIcon className="w-4 h-4" />
              Create New
            </button>
          )}
        </div>

        {/* Create Collection Form */}
        {showCreateForm && (
          <div className="bg-card border border-border p-4 mb-4">
            <h3 className="font-semibold mb-3">Create New Collection</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                className="flex-1 px-4 py-2 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateCollection}
                  disabled={creating || !newCollectionName.trim()}
                  className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-4 py-2 bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewCollectionName('');
                  }}
                  className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-4 py-2 border border-border hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {ownedCollections.length === 0 ? (
          <div className="bg-card border border-border p-4">
            <p className="text-muted-foreground">
              You don&apos;t have any collections yet. Create one or join someone else&apos;s collection.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ownedCollections.map((collection) => (
              <CollectionSettings
                key={collection.id}
                collection={{
                  id: collection.id,
                  name: collection.name,
                  owner_id: collection.owner_id,
                  created_at: '',
                }}
                memberCount={collection.member_count}
                isOwner={true}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Joined Collections Section */}
      {joinedCollections.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Joined Collections</h2>
          <div className="space-y-4">
            {joinedCollections.map((collection) => (
              <CollectionSettings
                key={collection.id}
                collection={{
                  id: collection.id,
                  name: collection.name,
                  owner_id: collection.owner_id,
                  created_at: '',
                }}
                memberCount={collection.member_count}
                isOwner={false}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        </section>
      )}

      {/* Join Collection */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Join a Collection</h2>
        <JoinCollection />
      </section>

      {/* Data Management */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <div className="bg-card border border-border p-4 space-y-3">
          <Link
            href="/import?tab=export"
            className="flex items-center gap-3 p-3 hover:bg-muted transition-colors -m-3 mb-0"
          >
            <ArrowDownTrayIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Export to CSV</div>
              <div className="text-sm text-muted-foreground">Download your collection as a CSV file</div>
            </div>
          </Link>
          <div className="border-t border-border" />
          <Link
            href="/import"
            className="flex items-center gap-3 p-3 hover:bg-muted transition-colors -m-3 mt-0"
          >
            <ArrowUpTrayIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Import Vehicles from CSV</div>
              <div className="text-sm text-muted-foreground">Add vehicles from a CSV file</div>
            </div>
          </Link>
          <div className="border-t border-border" />
          <Link
            href="/import?tab=photos"
            className="flex items-center gap-3 p-3 hover:bg-muted transition-colors -m-3 mt-0"
          >
            <PhotoIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="font-medium">Import Photos from Folder</div>
              <div className="text-sm text-muted-foreground">Bulk upload photos organized by vehicle</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Sign Out */}
      <section className="pt-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Sign Out
        </button>
      </section>

      {/* Danger Zone */}
      <DangerZone subscription={subscription} />
    </div>
  );
}
