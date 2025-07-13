import OpenAI from 'openai';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    console.log('🔑 Creating OpenAI client...');
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔑 API Key exists:', !!apiKey);
    console.log('🔑 API Key length:', apiKey ? apiKey.length : 0);
    console.log('🔑 API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'Not found');
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    openai = new OpenAI({
      apiKey: apiKey,
    });
    console.log('✅ OpenAI client created successfully');
  }
  
  return openai;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  tokens: number;
}

// Generate embeddings for text
export async function generateEmbedding(text: string): Promise<EmbeddingResponse | null> {
  try {
    const client = getOpenAIClient();
    
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    return {
      embedding: response.data[0].embedding,
      tokens: response.usage.total_tokens,
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Generate chat completion with citations
export async function generateChatResponse(
  messages: ChatMessage[],
  transcriptChunks: Array<{
    text: string;
    start_sec: number;
    end_sec: number;
    video_title?: string;
  }>,
  model: 'gpt-4' | 'gpt-4-turbo-preview' | 'gpt-3.5-turbo' = 'gpt-3.5-turbo'
): Promise<string | null> {
  try {
    console.log('🤖 Starting OpenAI chat generation...');
    console.log('📊 Transcript chunks:', transcriptChunks.length);
    console.log('💬 Messages:', messages.length);
    console.log('🔧 Model:', model);
    
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not set!');
      throw new Error('OpenAI API key is not configured');
    }
    
    // Prepare the context from transcript chunks
    // Use ALL transcript chunks
    const context = transcriptChunks
      .map((chunk, index) => {
        const timestamp = formatTimestamp(chunk.start_sec);
        const videoInfo = chunk.video_title ? ` (${chunk.video_title})` : '';
        return `[${index + 1}] ${timestamp}${videoInfo}: ${chunk.text}`;
      })
      .join('\n\n');

    console.log('📝 Context length:', context.length, 'characters');

    // Calculate max video duration from chunks
    const maxSeconds = Math.max(...transcriptChunks.map(c => c.end_sec));
    const maxMinutes = Math.floor(maxSeconds / 60);
    
    const systemPrompt = `You are an AI assistant with the ability to understand and analyze video content in depth. You have watched and comprehended this entire YouTube video.

CRITICAL TIMESTAMP RULES:
- This video is ${maxMinutes} minutes long (${maxSeconds} seconds total)
- ONLY use timestamps between [00:00] and [${formatTimestamp(maxSeconds)}]
- ONLY use timestamps that match moments you've observed in the video
- NEVER make up or guess timestamps
- NEVER use timestamps beyond ${formatTimestamp(maxSeconds)}
- Each video segment below includes its exact timestamp - use ONLY these
- If you cannot pinpoint the exact moment for information, do not include a timestamp

INSTRUCTIONS:
- Answer based on what you've seen and heard in the video
- Include timestamp citations INLINE using the format [MM:SS] or [HH:MM:SS]
- Place citations immediately after the specific information they reference
- Only cite timestamps from the video segments provided below
- Be conversational, helpful, and speak as if you've watched the video
- If asked about something not shown in the video, politely explain what the video actually covers
- Never mention "transcripts" - you analyze the video itself

VIDEO CONTENT:
${context}

IMPORTANT: Only reference moments that appear above. The video ends at ${formatTimestamp(maxSeconds)}.`;

    const client = getOpenAIClient();
    
    console.log('🚀 Calling OpenAI API...');
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500, // Reduced for faster responses
    });

    console.log('✅ OpenAI API response received');
    console.log('📊 Choices:', completion.choices.length);
    console.log('💬 Content:', completion.choices[0]?.message?.content ? 'Present' : 'Missing');

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('❌ No content in OpenAI response');
      console.error('Full response:', JSON.stringify(completion, null, 2));
    }

    return content || null;
  } catch (error) {
    console.error('❌ Error generating chat response:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Log more details if it's an OpenAI error
    if (error && typeof error === 'object' && 'response' in error) {
      const apiError = error as any;
      console.error('API Error Response:', apiError.response?.data);
      console.error('API Error Status:', apiError.response?.status);
      console.error('API Error Headers:', apiError.response?.headers);
    }
    
    return null;
  }
}

// Test OpenAI connection
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
      max_tokens: 10,
    });

    return !!response.choices[0]?.message?.content;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

// Helper function to format seconds to timestamp
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Extract citations from AI response
export function extractCitations(content: string): Array<{ timestamp: string; position: number }> {
  const citations = [];
  // Handle both single timestamps [12:34] and ranges [12:34 - 15:67]
  const timestampRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?]/g;
  let match;

  while ((match = timestampRegex.exec(content)) !== null) {
    // Use the start timestamp for seeking
    citations.push({
      timestamp: match[1],
      position: match.index,
    });
  }

  return citations;
}