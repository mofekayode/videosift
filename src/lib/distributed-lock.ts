import { supabaseAdmin } from './supabase';

/**
 * Simple distributed lock using database
 * This prevents multiple instances from processing the same resource
 */
export class DistributedLock {
  private static locks = new Map<string, NodeJS.Timeout>();

  /**
   * Acquire a lock for a resource
   * @param resourceId - Unique identifier for the resource (e.g., video_123)
   * @param ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
   * @returns true if lock acquired, false if already locked
   */
  static async acquire(resourceId: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      // Try to insert a lock record
      const { data, error } = await supabaseAdmin
        .from('processing_locks')
        .insert({
          resource_id: resourceId,
          locked_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
        })
        .select()
        .single();

      if (error) {
        // If unique constraint error, resource is already locked
        if (error.code === '23505') {
          // Check if existing lock is expired
          const { data: existingLock } = await supabaseAdmin
            .from('processing_locks')
            .select('*')
            .eq('resource_id', resourceId)
            .single();

          if (existingLock && new Date(existingLock.expires_at) < new Date()) {
            // Lock is expired, try to update it
            const { error: updateError } = await supabaseAdmin
              .from('processing_locks')
              .update({
                locked_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
              })
              .eq('resource_id', resourceId)
              .eq('expires_at', existingLock.expires_at); // Ensure no race condition

            return !updateError;
          }
          return false;
        }
        throw error;
      }

      // Set up auto-release timer
      const timeout = setTimeout(() => {
        this.release(resourceId);
      }, ttlSeconds * 1000);
      this.locks.set(resourceId, timeout);

      return true;
    } catch (error: any) {
      // Only log actual errors, not empty objects
      if (error && (error.message || error.code || Object.keys(error).length > 0)) {
        console.error('Error acquiring lock:', error);
      }
      return false;
    }
  }

  /**
   * Release a lock
   * @param resourceId - Resource identifier to unlock
   */
  static async release(resourceId: string): Promise<void> {
    try {
      // Clear timeout if exists
      const timeout = this.locks.get(resourceId);
      if (timeout) {
        clearTimeout(timeout);
        this.locks.delete(resourceId);
      }

      // Delete lock from database
      await supabaseAdmin
        .from('processing_locks')
        .delete()
        .eq('resource_id', resourceId);
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  /**
   * Clean up expired locks
   */
  static async cleanup(): Promise<void> {
    try {
      await supabaseAdmin
        .from('processing_locks')
        .delete()
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      console.error('Error cleaning up locks:', error);
    }
  }
}