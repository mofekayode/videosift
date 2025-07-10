# YouTube Transcript Downloader Documentation

This document explains how to use the YouTube Transcript API to download transcripts from YouTube videos and format them with proper timestamps.

## Table of Contents

1. [Installation](#installation)
2. [Basic Usage](#basic-usage)
3. [API Reference](#api-reference)
4. [Transcript Format](#transcript-format)
5. [Advanced Usage](#advanced-usage)
6. [Error Handling](#error-handling)
7. [Examples](#examples)
8. [Integration with MindSift](#integration-with-mindsift)

## Installation

The YouTube Transcript API is available as an npm package. Install it using:

```bash
npm install youtube-transcript-api
```

## Basic Usage

Here's a simple example of how to download a transcript:

```javascript
import YoutubeTranscriptApi from 'youtube-transcript-api';
import fs from 'fs/promises';

async function downloadTranscript(videoId) {
  try {
    // Get the transcript
    const transcript = await YoutubeTranscriptApi.getTranscript(videoId);
    
    // Format and save the transcript
    let formattedText = '';
    
    for (const segment of transcript) {
      const startTime = parseFloat(segment.start);
      const minutes = Math.floor(startTime / 60);
      const seconds = Math.floor(startTime % 60);
      const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      
      formattedText += `${timestamp} ${segment.text}\n`;
    }
    
    return formattedText;
  } catch (error) {
    console.error(`Error downloading transcript: ${error.message}`);
    return null;
  }
}

// Example usage
const videoId = 'BaWUPamqWlA'; // YouTube video ID
downloadTranscript(videoId).then(text => {
  if (text) {
    fs.writeFile(`${videoId}_transcript.txt`, text);
    console.log('Transcript downloaded successfully!');
  }
});
```

## API Reference

### Main Functions

#### `YoutubeTranscriptApi.getTranscript(videoId, options)`

Downloads the transcript for a YouTube video.

**Parameters:**
- `videoId` (string): The YouTube video ID (the part after `v=` in the YouTube URL)
- `options` (object, optional): Configuration options
  - `lang` (string, optional): Language code (e.g., 'en', 'es', 'fr')
  - `country` (string, optional): Country code (e.g., 'US', 'GB')

**Returns:**
- Promise that resolves to an array of transcript segments

### Transcript Segment Structure

Each segment in the transcript array has the following properties:

```javascript
{
  start: "123.45",   // Start time in seconds (as string)
  duration: "3.45",  // Duration of segment in seconds (as string)
  text: "Transcript text for this segment"
}
```

## Transcript Format

The raw transcript from the API contains segments with timestamps, but they need to be formatted for readability. Here's how to format them:

1. **Parse the timestamps**: Convert the `start` string to a float and calculate minutes and seconds
2. **Format timestamps**: Create a readable timestamp format like `[MM:SS]`
3. **Combine with text**: Add the timestamp before each text segment
4. **Handle consecutive segments**: Optionally add newlines between non-consecutive segments

## Advanced Usage

### Downloading Transcripts in Different Languages

```javascript
// Get transcript in Spanish (if available)
const transcript = await YoutubeTranscriptApi.getTranscript(videoId, { lang: 'es' });
```

### Handling Multiple Transcript Formats

Some videos have multiple transcript formats. You can list and select specific ones:

```javascript
// List available transcript formats
const transcriptList = await YoutubeTranscriptApi.listTranscripts(videoId);

// Get auto-generated transcript
const autoTranscript = await transcriptList.findTranscript(['en']);

// Get manually created transcript (usually more accurate)
const manualTranscript = await transcriptList.findManualTranscript(['en']);
```

### Batch Processing Videos

For processing multiple videos:

```javascript
async function batchProcessVideos(videoIds) {
  const results = {};
  
  for (const videoId of videoIds) {
    try {
      const transcript = await YoutubeTranscriptApi.getTranscript(videoId);
      results[videoId] = formatTranscript(transcript);
    } catch (error) {
      results[videoId] = { error: error.message };
    }
  }
  
  return results;
}
```

## Error Handling

Common errors when using the YouTube Transcript API:

1. **No transcript available**: The video doesn't have captions/transcripts
2. **Language not available**: The requested language isn't available for this video
3. **Invalid video ID**: The provided video ID doesn't exist or is incorrect
4. **Network errors**: Problems connecting to YouTube's servers

Example error handling:

```javascript
try {
  const transcript = await YoutubeTranscriptApi.getTranscript(videoId);
  // Process transcript
} catch (error) {
  if (error.message.includes('Could not find any transcripts')) {
    console.error('This video has no available transcripts');
  } else if (error.message.includes('Language not available')) {
    console.error('The requested language is not available');
  } else {
    console.error(`Error: ${error.message}`);
  }
}
```

## Examples

### Complete Script for Downloading and Formatting Transcripts

```javascript
/**
 * Script to download a YouTube video transcript
 * 
 * Usage: node download_transcript.js <videoId> [outputFile]
 * Example: node download_transcript.js BaWUPamqWlA transcript.txt
 */

import YoutubeTranscriptApi from 'youtube-transcript-api';
import fs from 'fs/promises';
import path from 'path';

async function downloadTranscript(videoId, outputFile) {
  try {
    console.log(`Downloading transcript for video ID: ${videoId}`);
    
    // Get the transcript
    const transcript = await YoutubeTranscriptApi.getTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.error('No transcript found for this video');
      return null;
    }
    
    console.log(`Transcript downloaded successfully with ${transcript.length} segments`);
    
    // Format the transcript
    let formattedTranscript = '';
    let previousEndTime = 0;
    
    for (const segment of transcript) {
      const startTime = parseFloat(segment.start);
      const duration = parseFloat(segment.duration);
      
      // Add a newline between segments that aren't consecutive
      if (previousEndTime > 0 && startTime > previousEndTime + 0.5) {
        formattedTranscript += '\n';
      }
      
      // Format timestamp as [MM:SS]
      const totalSeconds = Math.floor(startTime);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      
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
    console.error(`Error downloading transcript: ${error.message}`);
    return null;
  }
}

async function main() {
  // Get video ID from command line arguments
  const videoId = process.argv[2];
  
  if (!videoId) {
    console.error('Please provide a YouTube video ID');
    console.log('Usage: node download_transcript.js <videoId> [outputFile]');
    console.log('Example: node download_transcript.js BaWUPamqWlA transcript.txt');
    process.exit(1);
  }
  
  // Get output file path or use default
  const outputFile = process.argv[3] || path.join(process.cwd(), `${videoId}_transcript.txt`);
  
  // Download the transcript
  const result = await downloadTranscript(videoId, outputFile);
  
  if (!result) {
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
```

### Command Line Interface Usage

```bash
# Basic usage
node download_transcript.js dQw4w9WgXcQ

# Specify output file
node download_transcript.js dQw4w9WgXcQ rickroll_transcript.txt
```

## Integration with MindSift

To integrate the transcript downloader with the MindSift backend:

1. **Add to API**: Create an endpoint that accepts a YouTube URL or video ID
2. **Process and Store**: Download the transcript and store it in your database
3. **Index for Search**: Process the transcript for search indexing with Ragie

Example API endpoint:

```javascript
import express from 'express';
import YoutubeTranscriptApi from 'youtube-transcript-api';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Extract YouTube video ID from URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : url; // Return the URL as is if it's already a video ID
}

// Download transcript endpoint
router.post('/api/download-transcript', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL or video ID is required' });
    }
    
    const videoId = extractVideoId(url);
    
    // Get transcript
    const transcript = await YoutubeTranscriptApi.getTranscript(videoId);
    
    // Format transcript
    const formattedTranscript = formatTranscript(transcript);
    
    // Return the transcript
    res.json({
      success: true,
      videoId,
      transcript: formattedTranscript
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function formatTranscript(transcript) {
  // Format transcript as shown in previous examples
  // ...
}

export default router;
```

---

This documentation covers the basics of using the YouTube Transcript API to download and format video transcripts. For more advanced use cases or specific requirements, refer to the [official documentation](https://www.npmjs.com/package/youtube-transcript-api) of the package.
