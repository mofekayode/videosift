import { getCurrentAnonId, clearAnonId } from './session';

interface MigrationResult {
  success: boolean;
  sessions_migrated?: number;
  messages_migrated?: number;
  session_ids?: string[];
  error?: string;
}

/**
 * Client-side function to trigger session migration via API
 * This is safe to use in client components
 */
export async function migrateSessionsViaAPI(): Promise<MigrationResult> {
  try {
    const anonId = getCurrentAnonId();
    
    if (!anonId) {
      console.log('No anonymous sessions to migrate');
      return { success: true, sessions_migrated: 0, messages_migrated: 0 };
    }

    console.log(`🔄 Triggering migration for anon ID: ${anonId}`);

    // Call the API endpoint to handle migration
    const response = await fetch('/api/user/migrate-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ anonId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Migration failed');
    }

    // If migration was successful, clear the anonymous ID
    if (data.success && data.sessions_migrated > 0) {
      clearAnonId();
      console.log(`✅ Successfully migrated ${data.sessions_migrated} sessions with ${data.messages_migrated} messages`);
    }

    return data;
  } catch (error) {
    console.error('Migration failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}