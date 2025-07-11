import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AssistantConfig {
  name: string;
  instructions: string;
  model: string;
  vectorStoreId?: string;
}

export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}

// Create a vector store for a channel
export async function createVectorStore(channelTitle: string): Promise<string> {
  console.log('🗃️ Creating vector store for channel:', channelTitle);
  
  const vectorStore = await openai.beta.vectorStores.create({
    name: `${channelTitle} - Transcripts`,
    expires_after: {
      anchor: 'last_active_at',
      days: 30 // Auto-delete after 30 days of inactivity
    }
  });
  
  console.log('✅ Created vector store:', vectorStore.id);
  return vectorStore.id;
}

// Upload channel transcripts as a file to vector store
export async function uploadChannelTranscripts(
  vectorStoreId: string,
  transcriptContent: string,
  channelTitle: string
): Promise<string> {
  console.log('📁 Uploading transcripts to vector store:', vectorStoreId);
  
  // Create a buffer from the transcript content
  const buffer = Buffer.from(transcriptContent, 'utf-8');
  const fileName = `${channelTitle.replace(/[^a-zA-Z0-9]/g, '_')}_transcripts.txt`;
  
  // Upload file
  const file = await openai.files.create({
    file: new File([buffer], fileName, { type: 'text/plain' }),
    purpose: 'assistants',
  });
  
  console.log('📄 File uploaded:', file.id);
  
  // Add file to vector store
  await openai.beta.vectorStores.files.create(vectorStoreId, {
    file_id: file.id
  });
  
  console.log('✅ File added to vector store');
  return file.id;
}

// Create an assistant for a channel
export async function createChannelAssistant(config: AssistantConfig): Promise<string> {
  console.log('🤖 Creating assistant for channel:', config.name);
  
  const assistant = await openai.beta.assistants.create({
    name: config.name,
    instructions: config.instructions,
    model: config.model,
    tools: [{ type: 'file_search' }],
    tool_resources: config.vectorStoreId ? {
      file_search: {
        vector_store_ids: [config.vectorStoreId]
      }
    } : undefined
  });
  
  console.log('✅ Created assistant:', assistant.id);
  return assistant.id;
}

// Create a thread for conversation
export async function createThread(): Promise<string> {
  const thread = await openai.beta.threads.create();
  return thread.id;
}

// Send a message and get response from assistant
export async function chatWithAssistant(
  assistantId: string,
  threadId: string,
  message: string
): Promise<ThreadMessage> {
  console.log('💬 Sending message to assistant:', assistantId);
  
  // Add message to thread
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: message
  });
  
  // Run the assistant
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId
  });
  
  // Wait for completion
  let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  
  while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  }
  
  if (runStatus.status === 'failed') {
    console.error('❌ Assistant run failed:', runStatus.last_error);
    throw new Error('Assistant run failed');
  }
  
  // Get the assistant's response
  const messages = await openai.beta.threads.messages.list(threadId);
  const lastMessage = messages.data[0];
  
  if (lastMessage.role !== 'assistant') {
    throw new Error('Expected assistant message');
  }
  
  // Extract text content and citations
  let content = '';
  const citations: string[] = [];
  
  for (const contentItem of lastMessage.content) {
    if (contentItem.type === 'text') {
      content += contentItem.text.value;
      
      // Extract citations from annotations
      for (const annotation of contentItem.text.annotations) {
        if (annotation.type === 'file_citation') {
          citations.push(annotation.file_citation.file_id);
        }
      }
    }
  }
  
  console.log('✅ Got assistant response with', citations.length, 'citations');
  
  return {
    role: 'assistant',
    content,
    citations
  };
}

// Generate combined transcript content for a channel
export function generateChannelTranscriptContent(
  videos: Array<{
    youtube_id: string;
    title: string;
    transcript: Array<{ start: number; duration: number; text: string }>;
  }>
): string {
  let content = '';
  
  for (const video of videos) {
    content += `\n\n=== VIDEO: ${video.title} ===\n`;
    content += `YouTube ID: ${video.youtube_id}\n\n`;
    
    for (const segment of video.transcript) {
      const timestamp = formatTimestamp(segment.start);
      content += `[${timestamp}] ${segment.text}\n`;
    }
  }
  
  return content;
}

// Helper function to format seconds to timestamp
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Clean up resources
export async function deleteAssistant(assistantId: string): Promise<void> {
  await openai.beta.assistants.del(assistantId);
  console.log('🗑️ Deleted assistant:', assistantId);
}

export async function deleteVectorStore(vectorStoreId: string): Promise<void> {
  await openai.beta.vectorStores.del(vectorStoreId);
  console.log('🗑️ Deleted vector store:', vectorStoreId);
}