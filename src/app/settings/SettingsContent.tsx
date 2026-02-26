'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/types/database';
import { CollectionSettings } from '@/components/settings/CollectionSettings';
import { JoinCollection } from '@/components/settings/JoinCollection';
import { ShareLinksSection } from '@/components/settings/ShareLinksSection';
import DangerZone from '@/components/settings/DangerZone';
import { createClient } from '@/lib/supabase/client';
import { CircleStackIcon, PlusIcon, PencilIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { Subscription } from '@/lib/subscription';
import { isPro, FREE_VEHICLE_LIMIT } from '@/lib/subscription';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.receive_notifications ?? true);
  const [editNotifications, setEditNotifications] = useState(profile?.receive_notifications ?? true);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState(user.email || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editFirstName, setEditFirstName] = useState(profile?.first_name || '');
  const [editLastName, setEditLastName] = useState(profile?.last_name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone_number || '');
  const [upgradeLoading, setUpgradeLoading] = useState<'monthly' | 'annual' | null>(null);

  const isProUser = isPro(subscription);
  const vehicleLimit = isProUser ? 'Unlimited' : FREE_VEHICLE_LIMIT;

  const handleUpgrade = async (plan: 'monthly' | 'annual') => {
    setUpgradeLoading(plan);
    try {
      const priceId =
        plan === 'monthly'
          ? process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;

      if (!priceId) {
        alert('Payment is not configured yet. Please try again later.');
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to start checkout. Please try again.');
      }
    } catch {
      alert('Failed to start checkout. Please try again.');
    } finally {
      setUpgradeLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleUpdate = () => {
    router.refresh();
  };

  const handleCancelEdit = () => {
    setEditingAccount(false);
    setAccountError(null);
    setEditEmail(user.email || '');
    setEditUsername(profile?.username || '');
    setEditFirstName(profile?.first_name || '');
    setEditLastName(profile?.last_name || '');
    setEditPhone(profile?.phone_number || '');
    setEditNotifications(notificationsEnabled);
  };

  const handleSaveAccount = async () => {
    setSavingAccount(true);
    setAccountError(null);
    try {
      // Update email via auth if changed
      if (editEmail.trim() !== (user.email || '')) {
        const { error } = await supabase.auth.updateUser({ email: editEmail.trim() });
        if (error) {
          setAccountError(error.message);
          return;
        }
        setEmailMessage('Check your new email for a confirmation link.');
      }

      // Update profile fields
      const { error } = await supabase
        .from('profiles')
        .update({
          username: editUsername.trim() || null,
          first_name: editFirstName.trim() || null,
          last_name: editLastName.trim() || null,
          phone_number: editPhone.trim() || null,
          receive_notifications: editNotifications,
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          setAccountError('Username taken');
          return;
        }
        setAccountError(error.message);
        return;
      }

      setNotificationsEnabled(editNotifications);
      setEditingAccount(false);
      router.refresh();
    } finally {
      setSavingAccount(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBust })
        .eq('id', user.id);

      if (!updateError) {
        setAvatarUrl(urlWithCacheBust);
        router.refresh();
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      // List all files in user's avatar folder
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (files?.length) {
        await supabase.storage
          .from('avatars')
          .remove(files.map(f => `${user.id}/${f.name}`));
      }

      await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      setAvatarUrl('');
      router.refresh();
    } finally {
      setUploadingAvatar(false);
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
      {/* Account Section */}
      <section id="subscription">
        <h2 className="text-lg font-semibold mb-4">Account</h2>

        {/* Subscription warnings (above card) */}
        {subscription?.status === 'past_due' && (
          <div className="bg-destructive/10 p-3 border border-destructive/30 mb-3 text-sm text-destructive">
            Your payment is past due. Please update your payment method to continue your Pro subscription.
          </div>
        )}
        {subscription?.cancel_at_period_end && subscription.status === 'active' && (
          <div className="bg-destructive/10 p-3 border border-destructive/30 mb-3 space-y-2">
            <p className="font-semibold text-sm text-destructive">Your subscription has been cancelled</p>
            <p className="text-xs text-destructive">
              {(() => {
                if (!subscription.current_period_end) return 'Your access will end soon.';
                const endDate = new Date(subscription.current_period_end);
                const now = new Date();
                const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysLeft <= 0) return 'Your access has ended.';
                if (daysLeft === 1) return '1 day left. Export your data — vehicles beyond the free limit will be deleted.';
                return `${daysLeft} days left. Export your data — vehicles beyond the free limit will be deleted.`;
              })()}
            </p>
          </div>
        )}

        <div className="bg-card border border-border overflow-hidden">
          {accountError && (
            <div className="bg-destructive/10 border-b border-destructive text-destructive px-4 py-2.5 text-sm">
              {accountError}
            </div>
          )}
          {emailMessage && (
            <div className="flex items-center justify-between gap-2 bg-secondary/10 border-b border-secondary px-4 py-2.5 text-sm text-secondary-foreground dark:text-secondary">
              <span>{emailMessage}</span>
              <button onClick={() => setEmailMessage(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Avatar header area with Edit button */}
          <div className="relative p-4 border-b border-border">
            {/* Edit / Save+Cancel — top right inside the card */}
            <div className="absolute top-3 right-3">
              {!editingAccount ? (
                <button
                  onClick={() => setEditingAccount(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-destructive border border-destructive hover:bg-destructive/10 transition-colors"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  Edit
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={handleSaveAccount}
                    disabled={savingAccount}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    {savingAccount ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2.5 py-1 text-xs border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pr-20">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 ring-2 ring-border">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-2xl font-semibold text-muted-foreground">
                    {(profile?.first_name?.[0] || profile?.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || 'Your Profile'}
                </p>
                {profile?.username && (profile?.first_name || profile?.last_name) && (
                  <p className="text-sm text-muted-foreground truncate">@{profile.username}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-2.5 py-1 text-xs bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {uploadingAvatar ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {avatarUrl && (
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="px-2.5 py-1 text-xs border border-border hover:bg-muted disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fields */}
          {editingAccount ? (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-1.5 text-base sm:text-sm bg-background border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {/* Notifications toggle (only in edit mode) */}
              <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-border">
                <input
                  type="checkbox"
                  checked={editNotifications}
                  onChange={(e) => setEditNotifications(e.target.checked)}
                  className="h-4 w-4 accent-primary cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium">Tab expiration reminders</span>
                  <p className="text-xs text-muted-foreground">Email reminders at 30 days, 7 days, and day-of</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Username</span>
                <span className="font-medium text-sm">{profile?.username ? `@${profile.username}` : <span className="text-muted-foreground italic">Not set</span>}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium text-sm">{user.email || <span className="text-muted-foreground italic">Not set</span>}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="font-medium text-sm">{profile?.phone_number || <span className="text-muted-foreground italic">Not set</span>}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Notifications</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${notificationsEnabled ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                  {notificationsEnabled ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          )}

          {/* Subscription row */}
          <div className="px-4 py-3 bg-muted/30 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isProUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isProUser
                    ? `Pro ${subscription?.plan === 'annual' ? '(Annual)' : '(Monthly)'}`
                    : 'Free'}
                </span>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {vehicleCount} / {vehicleLimit} vehicles
              </span>
            </div>

            {/* Billing details for Pro users */}
            {isProUser && !subscription?.cancel_at_period_end && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Next billing: {formatDate(subscription?.current_period_end ?? null)}
              </p>
            )}
            {isProUser && subscription?.cancel_at_period_end && (
              <p className="text-xs text-destructive mt-1.5">
                Access ends: {formatDate(subscription?.current_period_end ?? null)}
              </p>
            )}

            {/* Upgrade / Renew buttons */}
            {(!isProUser || subscription?.cancel_at_period_end) && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleUpgrade('monthly')}
                  disabled={upgradeLoading !== null}
                  className="flex-1 py-2 text-xs font-medium border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  {upgradeLoading === 'monthly' ? 'Loading...' : '$5/mo'}
                </button>
                <button
                  onClick={() => handleUpgrade('annual')}
                  disabled={upgradeLoading !== null}
                  className="flex-1 py-2 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 relative transition-opacity"
                >
                  {upgradeLoading === 'annual' ? 'Loading...' : (
                    <>
                      $40/yr
                      <span className="ml-1.5 text-[10px] font-normal opacity-80">Save 33%</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Data Management */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <div className="bg-card border border-border">
          <Link
            href="/import"
            className="flex items-center gap-3 p-4 hover:bg-muted transition-colors"
          >
            <CircleStackIcon className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">Data Management</div>
              <div className="text-sm text-muted-foreground">Import and export your vehicle data</div>
            </div>
          </Link>
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
                userRole={collection.role}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Share Links */}
      {collections.some(c => c.is_owner || c.role === 'editor') && (
        <ShareLinksSection collections={collections} />
      )}

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
                userRole={collection.role}
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
