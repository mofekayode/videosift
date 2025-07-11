import { NextResponse } from 'next/server';

export interface CacheHeaders {
  'Cache-Control'?: string;
  'ETag'?: string;
  'Last-Modified'?: string;
  'Expires'?: string;
  'X-Cache-Status'?: 'HIT' | 'MISS' | 'STALE';
}

export function setCacheHeaders(response: NextResponse, options: {
  maxAge?: number;
  staleWhileRevalidate?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
  etag?: string;
  lastModified?: Date;
  cacheStatus?: 'HIT' | 'MISS' | 'STALE';
}): NextResponse {
  const {
    maxAge = 300, // 5 minutes default
    staleWhileRevalidate = 60,
    mustRevalidate = false,
    noCache = false,
    etag,
    lastModified,
    cacheStatus = 'MISS'
  } = options;

  if (noCache) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  } else {
    let cacheControl = `public, max-age=${maxAge}`;
    
    if (staleWhileRevalidate > 0) {
      cacheControl += `, stale-while-revalidate=${staleWhileRevalidate}`;
    }
    
    if (mustRevalidate) {
      cacheControl += ', must-revalidate';
    }
    
    response.headers.set('Cache-Control', cacheControl);
    
    if (etag) {
      response.headers.set('ETag', etag);
    }
    
    if (lastModified) {
      response.headers.set('Last-Modified', lastModified.toUTCString());
    }
    
    if (maxAge > 0) {
      const expires = new Date(Date.now() + maxAge * 1000);
      response.headers.set('Expires', expires.toUTCString());
    }
  }
  
  response.headers.set('X-Cache-Status', cacheStatus);
  
  return response;
}

export function generateETag(data: any): string {
  const hash = require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
}

export function parseIfNoneMatch(ifNoneMatch?: string): string[] {
  if (!ifNoneMatch) return [];
  return ifNoneMatch.split(',').map(tag => tag.trim().replace(/"/g, ''));
}

export function isNotModified(etag: string, ifNoneMatch?: string): boolean {
  if (!ifNoneMatch) return false;
  const clientETags = parseIfNoneMatch(ifNoneMatch);
  return clientETags.includes(etag) || clientETags.includes('*');
}

export const CacheConfig = {
  // API response cache times (in seconds)
  VIDEO_METADATA: 24 * 60 * 60, // 24 hours
  TRANSCRIPT_DATA: 7 * 24 * 60 * 60, // 7 days
  CHAT_RESPONSES: 2 * 60 * 60, // 2 hours
  USER_SESSION: 60 * 60, // 1 hour
  CHANNEL_DATA: 6 * 60 * 60, // 6 hours
  
  // Static asset cache times
  IMAGES: 30 * 24 * 60 * 60, // 30 days
  SCRIPTS: 24 * 60 * 60, // 24 hours
  STYLES: 24 * 60 * 60, // 24 hours
} as const;