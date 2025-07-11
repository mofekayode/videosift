// Temporarily comment out to avoid circular dependency
// import { supabase } from './supabase';

export interface CacheConfig {
  // Cache TTL in seconds
  video_metadata: number;
  transcript_chunks: number;
  user_sessions: number;
  channel_data: number;
  openai_responses: number;
}

export const CACHE_CONFIG: CacheConfig = {
  video_metadata: 24 * 60 * 60, // 24 hours
  transcript_chunks: 7 * 24 * 60 * 60, // 7 days  
  user_sessions: 60 * 60, // 1 hour
  channel_data: 6 * 60 * 60, // 6 hours
  openai_responses: 2 * 60 * 60, // 2 hours
};

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expires_at: number;
  cache_key: string;
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private maxMemoryEntries = 1000;

  /**
   * Get cached data from memory first, then database
   */
  async get<T>(key: string, ttl?: number): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && Date.now() < memoryEntry.expires_at) {
      return memoryEntry.data;
    }

    // Check database cache
    try {
      // Import supabase dynamically to avoid circular dependency
      const { supabase } = await import('./supabase');
      
      const { data, error } = await supabase
        .from('cache_entries')
        .select('*')
        .eq('cache_key', key)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      // Store in memory cache for faster access
      this.setMemoryCache(key, data.data, data.expires_at);
      return data.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data in both memory and database
   */
  async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || CACHE_CONFIG.openai_responses;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Set in memory cache
    this.setMemoryCache(key, data, expiresAt.getTime());

    // Set in database cache
    try {
      const { supabase } = await import('./supabase');
      await supabase.from('cache_entries').upsert({
        cache_key: key,
        data: data,
        timestamp: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached entry
   */
  async delete(key: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(key);

    // Remove from database
    try {
      const { supabase } = await import('./supabase');
      await supabase
        .from('cache_entries')
        .delete()
        .eq('cache_key', key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear expired entries from memory cache
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expires_at) {
        this.memoryCache.delete(key);
      }
    }

    // Limit memory cache size
    if (this.memoryCache.size > this.maxMemoryEntries) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, entries.length - this.maxMemoryEntries);
      toDelete.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  /**
   * Set memory cache entry
   */
  private setMemoryCache<T>(key: string, data: T, expiresAt: number): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      expires_at: expiresAt,
      cache_key: key,
    });

    // Cleanup old entries
    this.cleanupMemoryCache();
  }

  /**
   * Generate cache key for video metadata
   */
  static videoMetadataKey(videoId: string): string {
    return `video_metadata:${videoId}`;
  }

  /**
   * Generate cache key for transcript chunks
   */
  static transcriptChunksKey(videoId: string, query: string): string {
    return `transcript_chunks:${videoId}:${Buffer.from(query).toString('base64')}`;
  }

  /**
   * Generate cache key for user session
   */
  static userSessionKey(sessionId: string): string {
    return `user_session:${sessionId}`;
  }

  /**
   * Generate cache key for channel data
   */
  static channelDataKey(channelId: string): string {
    return `channel_data:${channelId}`;
  }

  /**
   * Generate cache key for OpenAI response
   */
  static openaiResponseKey(prompt: string, model: string): string {
    const hash = Buffer.from(`${prompt}:${model}`).toString('base64');
    return `openai_response:${hash}`;
  }

  /**
   * Bulk delete cache entries by pattern
   */
  async deleteByPattern(pattern: string): Promise<void> {
    // Remove from memory
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Remove from database using LIKE pattern
    try {
      const { supabase } = await import('./supabase');
      await supabase
        .from('cache_entries')
        .delete()
        .like('cache_key', `%${pattern}%`);
    } catch (error) {
      console.error('Cache delete by pattern error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory_entries: number;
    db_entries: number;
    memory_size_bytes: number;
  }> {
    const memoryEntries = this.memoryCache.size;
    const memorySizeBytes = JSON.stringify(Array.from(this.memoryCache.values())).length;

    let dbEntries = 0;
    try {
      const { supabase } = await import('./supabase');
      const { count } = await supabase
        .from('cache_entries')
        .select('*', { count: 'exact' })
        .gt('expires_at', new Date().toISOString());
      
      dbEntries = count || 0;
    } catch (error) {
      console.error('Cache stats error:', error);
    }

    return {
      memory_entries: memoryEntries,
      db_entries: dbEntries,
      memory_size_bytes: memorySizeBytes,
    };
  }
}

export const cacheManager = new CacheManager();

// Utility functions for specific cache operations
export const CacheUtils = {
  /**
   * Cache video metadata with appropriate TTL
   */
  async cacheVideoMetadata(videoId: string, metadata: any): Promise<void> {
    const key = CacheManager.videoMetadataKey(videoId);
    await cacheManager.set(key, metadata, CACHE_CONFIG.video_metadata);
  },

  /**
   * Get cached video metadata
   */
  async getCachedVideoMetadata(videoId: string): Promise<any | null> {
    const key = CacheManager.videoMetadataKey(videoId);
    return await cacheManager.get(key);
  },

  /**
   * Cache transcript search results
   */
  async cacheTranscriptSearch(videoId: string, query: string, results: any): Promise<void> {
    const key = CacheManager.transcriptChunksKey(videoId, query);
    await cacheManager.set(key, results, CACHE_CONFIG.transcript_chunks);
  },

  /**
   * Get cached transcript search results
   */
  async getCachedTranscriptSearch(videoId: string, query: string): Promise<any | null> {
    const key = CacheManager.transcriptChunksKey(videoId, query);
    return await cacheManager.get(key);
  },

  /**
   * Cache OpenAI response
   */
  async cacheOpenAIResponse(prompt: string, model: string, response: any): Promise<void> {
    const key = CacheManager.openaiResponseKey(prompt, model);
    await cacheManager.set(key, response, CACHE_CONFIG.openai_responses);
  },

  /**
   * Get cached OpenAI response
   */
  async getCachedOpenAIResponse(prompt: string, model: string): Promise<any | null> {
    const key = CacheManager.openaiResponseKey(prompt, model);
    return await cacheManager.get(key);
  },

  /**
   * Invalidate all caches for a video
   */
  async invalidateVideoCache(videoId: string): Promise<void> {
    await cacheManager.deleteByPattern(`video_metadata:${videoId}`);
    await cacheManager.deleteByPattern(`transcript_chunks:${videoId}`);
  },

  /**
   * Cleanup expired cache entries
   */
  async cleanupExpiredEntries(): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      await supabase
        .from('cache_entries')
        .delete()
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  },
};