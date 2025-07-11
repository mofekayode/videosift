import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const response = await openai.embeddings.create({
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
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo' = 'gpt-4o-mini'
): Promise<string | null> {
  try {
    // Prepare the context from transcript chunks
    // Use ALL transcript chunks
    const context = transcriptChunks
      .map((chunk, index) => {
        const timestamp = formatTimestamp(chunk.start_sec);
        const videoInfo = chunk.video_title ? ` (${chunk.video_title})` : '';
        return `[${index + 1}] ${timestamp}${videoInfo}: ${chunk.text}`;
      })
      .join('\n\n');

    const systemPrompt = `You are a helpful AI assistant that answers questions about YouTube videos based on their transcripts. 

INSTRUCTIONS:
- Base your answers ONLY on the provided transcript chunks
- Include timestamp citations INLINE throughout your response using the format [timestamp] 
- Place citations immediately after the specific information they support
- Use the exact timestamps provided (e.g., [01:23], [15:42])
- Be conversational and friendly
- If you can't answer based on the video content, say "The video doesn't cover that topic" instead of "transcript doesn't"
- Provide specific, detailed answers when possible

EXAMPLE FORMAT:
"The video discusses quantum mechanics [02:15] and how Einstein disagreed with certain interpretations [04:30]. The speaker explains that..."

AVAILABLE TRANSCRIPT CHUNKS:
${context}

Remember to cite specific timestamps INLINE when referencing information from the video.`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 800, // Reduced for faster responses
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Error generating chat response:', error);
    return null;
  }
}

// Test OpenAI connection
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
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
  const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?]/g;
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