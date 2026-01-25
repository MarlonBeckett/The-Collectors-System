'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JoinCollection() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length !== 6) {
      setError('Join code must be 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/collections/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ joinCode: normalizedCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to join collection');
        return;
      }

      setSuccess(`Joined "${data.collection.name}" successfully!`);
      setCode('');

      // Refresh the page to show updated collections
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err) {
      setError('Failed to join collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border p-4">
      <h3 className="font-semibold mb-2">Join a Collection</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Enter a 6-character code to join someone else&apos;s collection
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="Enter join code"
            className="w-full px-4 py-3 bg-background border border-input font-mono text-lg text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={6}
          />
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        {success && (
          <div className="text-sm text-secondary">{success}</div>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Joining...' : 'Join Collection'}
        </button>
      </form>
    </div>
  );
}
