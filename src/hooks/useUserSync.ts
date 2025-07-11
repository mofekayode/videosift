'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export function useUserSync() {
  const { user, isSignedIn } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && user && !isSyncing) {
      syncUser();
    }
  }, [isSignedIn, user]);

  const syncUser = async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync user');
      }

      const result = await response.json();
      console.log('✅ User synced successfully:', result.user);
    } catch (error) {
      console.error('❌ User sync failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, syncError, syncUser };
}