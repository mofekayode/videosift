import { NextRequest, NextResponse } from 'next/server';
import { cacheManager, CacheUtils } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Getting cache statistics...');

    // Get cache stats
    const stats = await cacheManager.getStats();
    
    console.log('Cache Statistics:', stats);

    return NextResponse.json({
      success: true,
      stats: {
        memory: {
          entries: stats.memory_entries,
          size_bytes: stats.memory_size_bytes,
          size_mb: Math.round(stats.memory_size_bytes / 1024 / 1024 * 100) / 100
        },
        database: {
          entries: stats.db_entries
        },
        total_entries: stats.memory_entries + stats.db_entries
      },
      message: 'Cache statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get cache statistics',
      details: error
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 Cleaning up expired cache entries...');

    // Cleanup expired entries
    await CacheUtils.cleanupExpiredEntries();
    
    // Get updated stats
    const stats = await cacheManager.getStats();

    console.log('✅ Cache cleanup completed');

    return NextResponse.json({
      success: true,
      message: 'Cache cleanup completed successfully',
      remaining_entries: {
        memory: stats.memory_entries,
        database: stats.db_entries
      }
    });

  } catch (error) {
    console.error('Cache cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup cache',
      details: error
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, pattern } = await request.json();

    if (action === 'clear_pattern' && pattern) {
      console.log(`🗑️ Clearing cache entries matching pattern: ${pattern}`);
      await cacheManager.deleteByPattern(pattern);
      
      return NextResponse.json({
        success: true,
        message: `Cleared cache entries matching pattern: ${pattern}`
      });
    }
    
    if (action === 'clear_all') {
      console.log('🗑️ Clearing all cache entries...');
      
      // Clear all cache entries by deleting with a wildcard pattern
      await cacheManager.deleteByPattern(''); // Empty pattern matches everything
      
      return NextResponse.json({
        success: true,
        message: 'All cache entries cleared'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use "clear_pattern" with pattern or "clear_all"'
    }, { status: 400 });

  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to manage cache',
      details: error
    }, { status: 500 });
  }
}