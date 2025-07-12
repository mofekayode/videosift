// Test script to diagnose chat API issues
require('dotenv').config({ path: '.env.local' });

const videoId = 'BHO_glbVcIg'; // A video that exists in the database
const PORT = 3000; // Updated to use correct port

async function testChatApi() {
  console.log('Testing chat API endpoints...\n');

  // Test 1: Check if video exists in database
  console.log('1. Testing video metadata...');
  try {
    const metadataResponse = await fetch(`http://localhost:${PORT}/api/video/metadata?videoId=${videoId}`);
    console.log('Metadata response status:', metadataResponse.status);
    const metadata = await metadataResponse.text();
    try {
      const jsonData = JSON.parse(metadata);
      console.log('Video metadata response:', jsonData);
    } catch (e) {
      console.log('Metadata response text:', metadata);
    }
  } catch (error) {
    console.error('Video metadata error:', error);
  }

  console.log('\n2. Testing transcript endpoint...');
  try {
    const transcriptResponse = await fetch(`http://localhost:${PORT}/api/video/transcript?videoId=${videoId}`);
    console.log('Transcript response status:', transcriptResponse.status);
    const transcript = await transcriptResponse.text();
    try {
      const jsonData = JSON.parse(transcript);
      console.log('Transcript response:', jsonData);
    } catch (e) {
      console.log('Transcript response text:', transcript);
    }
  } catch (error) {
    console.error('Transcript error:', error);
  }

  console.log('\n3. Testing chat endpoint...');
  try {
    const chatResponse = await fetch(`http://localhost:${PORT}/api/chat-simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What is this video about?',
        videoId: videoId,
        messages: []
      })
    });
    
    console.log('Chat response status:', chatResponse.status);
    const chatData = await chatResponse.text();
    try {
      const jsonData = JSON.parse(chatData);
      console.log('Chat response:', jsonData);
    } catch (e) {
      console.log('Chat response text:', chatData);
    }
  } catch (error) {
    console.error('Chat error:', error);
  }

  console.log('\n4. Testing OpenAI configuration...');
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
  console.log('OPENAI_API_KEY starts with:', process.env.OPENAI_API_KEY?.substring(0, 7) + '...');
}

testChatApi();