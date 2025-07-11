/**
 * Script to download a YouTube video transcript
 * 
 * Usage: ts-node download_transcript.ts <videoId> [outputFile]
 * Example: ts-node download_transcript.ts BaWUPamqWlA transcript.txt
 */

import YoutubeTranscriptApi from 'youtube-transcript-api';
import fs from 'fs/promises';
import path from 'path';

// Define types for the transcript segments
interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

/**
 * Downloads and formats a YouTube video transcript
 * @param videoId - The YouTube video ID
 * @param outputFile - Path to save the transcript
 * @returns Path to the saved file or null if failed
 */
async function downloadTranscript(videoId: string, outputFile: string): Promise<string | null> {
  try {
    console.log(`Downloading transcript for video ID: ${videoId}`);
    
    // Get the transcript
    const transcript: TranscriptSegment[] = await YoutubeTranscriptApi.getTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.error('No transcript found for this video');
      return null;
    }
    
    console.log(`Transcript downloaded successfully with ${transcript.length} segments`);
    
    // Format the transcript
    let formattedTranscript: string = '';
    let previousEndTime: number = 0;
    
    for (const segment of transcript) {
      const startTime: number = segment.start;
      const duration: number = segment.duration;
      
      // Add a newline between segments that aren't consecutive
      if (previousEndTime > 0 && startTime > previousEndTime + 0.5) {
        formattedTranscript += '\n';
      }
      
      // Format timestamp as [MM:SS]
      const totalSeconds: number = Math.floor(startTime);
      const minutes: number = Math.floor(totalSeconds / 60);
      const seconds: number = totalSeconds % 60;
      const timestamp: string = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      
      // Add the segment with timestamp
      formattedTranscript += `${timestamp} ${segment.text}\n`;
      
      // Update previous end time
      previousEndTime = startTime + duration;
    }
    
    // Save to file
    await fs.writeFile(outputFile, formattedTranscript);
    console.log(`Transcript saved to ${outputFile}`);
    
    return outputFile;
  } catch (error) {
    console.error(`Error downloading transcript: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Extract video ID from a YouTube URL
 * @param input - YouTube URL or video ID
 * @returns Extracted video ID
 */
function extractVideoId(input: string): string {
  // Check if input is already a video ID (typically 11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }
  
  // Extract from URL
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  throw new Error('Invalid YouTube URL or video ID');
}

/**
 * Main function to handle command line arguments and run the download
 */
async function main(): Promise<void> {
  // Get video ID or URL from command line arguments
  const videoInput: string | undefined = process.argv[2];
  
  if (!videoInput) {
    console.error('Please provide a YouTube video ID or URL');
    console.log('Usage: ts-node download_transcript.ts <videoId|url> [outputFile]');
    console.log('Example: ts-node download_transcript.ts BaWUPamqWlA transcript.txt');
    process.exit(1);
  }
  
  try {
    // Extract video ID if URL was provided
    const videoId: string = extractVideoId(videoInput);
    
    // Get output file path or use default
    const outputFile: string = process.argv[3] || path.join(process.cwd(), `${videoId}_transcript.txt`);
    
    // Download the transcript
    const result = await downloadTranscript(videoId, outputFile);
    
    if (!result) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
