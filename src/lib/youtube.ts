export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

export function isValidYouTubeChannelUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /^https?:\/\/(www\.)?youtube\.com\/c\/([a-zA-Z0-9._-]+)/,
    /^https?:\/\/(www\.)?youtube\.com\/user\/([a-zA-Z0-9._-]+)/,
    /^https?:\/\/(www\.)?youtube\.com\/@([a-zA-Z0-9._-]+)/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

export function extractChannelId(url: string): string | null {
  // Handle direct channel ID format
  const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelMatch) {
    return channelMatch[1];
  }
  
  // Handle @username format (more flexible pattern)
  const atMatch = url.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/);
  if (atMatch) {
    return atMatch[1];
  }
  
  // Handle /c/ custom URL format
  const customMatch = url.match(/youtube\.com\/c\/([a-zA-Z0-9._-]+)/);
  if (customMatch) {
    return customMatch[1];
  }
  
  // Handle /user/ format
  const userMatch = url.match(/youtube\.com\/user\/([a-zA-Z0-9._-]+)/);
  if (userMatch) {
    return userMatch[1];
  }
  
  return null;
}