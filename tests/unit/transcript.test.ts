import { describe, test, expect } from '@playwright/test';
import { downloadTranscript } from '../../src/lib/transcript';

describe('Transcript Download', () => {
  test('should download transcript for valid video', async () => {
    // Use a known video with captions
    const videoId = 'jNQXAC9IVRw'; // "Me at the zoo"
    
    try {
      const segments = await downloadTranscript(videoId);
      
      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      expect(segments.length).toBeGreaterThan(0);
      
      // Check segment structure
      const firstSegment = segments[0];
      expect(firstSegment).toHaveProperty('start');
      expect(firstSegment).toHaveProperty('end');
      expect(firstSegment).toHaveProperty('text');
      expect(typeof firstSegment.start).toBe('number');
      expect(typeof firstSegment.end).toBe('number');
      expect(typeof firstSegment.text).toBe('string');
    } catch (error) {
      // If this fails, we know there's an issue with transcript downloading
      console.error('Transcript download failed:', error);
      throw error;
    }
  });

  test('should handle video without captions gracefully', async () => {
    const videoId = 'invalid_video_id_12345';
    
    await expect(downloadTranscript(videoId)).rejects.toThrow(/transcript/i);
  });

  test('should handle network errors', async () => {
    // This would require mocking the YouTube API
    // For now, just check that errors are properly thrown
    const videoId = '';
    
    await expect(downloadTranscript(videoId)).rejects.toThrow();
  });
});