import { supabase } from './supabase';

interface MigrationResult {
  success: boolean;
  sessions_migrated?: number;
  messages_migrated?: number;
  session_ids?: string[];
  error?: string;
}

/**
 * Server-side migration function
 * This should only be called from server components or API routes
 */
export async function migrateAnonSessionsToUser(userId: string, anonId: string): Promise<MigrationResult> {
  try {
    if (!anonId) {
      console.log('No anonymous ID provided for migration');
      return { success: true, sessions_migrated: 0, messages_migrated: 0 };
    }

    console.log(`🔄 Migrating sessions from ${anonId} to user ${userId}`);

    // Call the database function to migrate sessions
    const { data, error } = await supabase.rpc('migrate_anon_sessions_to_user', {
      p_user_id: userId,
      p_anon_id: anonId
    });

    if (error) {
      console.error('Migration error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }

    if (data?.success) {
      console.log(`✅ Successfully migrated ${data.sessions_migrated} sessions with ${data.messages_migrated} messages`);
    }

    return data || { success: false, error: 'No data returned from migration' };
  } catch (error) {
    console.error('Migration failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}