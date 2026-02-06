'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { Subscription } from '@/lib/subscription';
import { isPro } from '@/lib/subscription';

interface DangerZoneProps {
  subscription: Subscription | null;
}

export default function DangerZone({ subscription }: DangerZoneProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const isProUser = isPro(subscription);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
      });

      if (res.ok) {
        router.push('/login?deleted=true');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete account');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 text-red-500">Danger Zone</h2>
      <div className="bg-red-500/5 border border-red-500/20 p-4 space-y-4">
        {/* Manage/Cancel Subscription */}
        {isProUser && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-red-500/20">
            <div>
              <p className="font-medium text-foreground">Cancel Subscription</p>
              <p className="text-sm text-muted-foreground">
                Manage or cancel your Pro subscription
              </p>
            </div>
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="px-4 py-2 border border-red-500/50 text-red-500 text-sm font-medium hover:bg-red-500/10 disabled:opacity-50"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          </div>
        )}

        {/* Delete Account */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">Delete Account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all data
            </p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-500 text-white text-sm font-medium hover:bg-red-600"
          >
            Delete Account
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Delete Account</h3>
              </div>

              <p className="text-muted-foreground mb-4">
                This action cannot be undone. This will permanently delete:
              </p>

              <ul className="text-sm text-muted-foreground mb-4 space-y-1 list-disc list-inside">
                <li>Your account and profile</li>
                <li>All collections you own</li>
                <li>All vehicles and photos in those collections</li>
                <li>Your subscription (if active)</li>
              </ul>

              <p className="text-sm text-foreground mb-2">
                Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm:
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3 py-2 bg-background border border-input text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 border border-border text-foreground font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
