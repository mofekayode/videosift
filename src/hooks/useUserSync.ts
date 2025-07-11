'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { getStoredAnonId, clearAnonId } from '@/lib/session';

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
      // Get stored anon_id to migrate sessions
      const anonId = getStoredAnonId();
      
      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anonId: anonId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync user');
      }

      const result = await response.json();
      console.log('✅ User synced successfully:', result.user);
      
      // If sessions were migrated, optionally clear the anon ID
      if (result.migratedSessions > 0) {
        console.log(`✅ Migrated ${result.migratedSessions} anonymous sessions to user account`);
        // Clear the anon ID since the sessions are now linked to the user
        clearAnonId();
      }
    } catch (error) {
      console.error('❌ User sync failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, syncError, syncUser };
}