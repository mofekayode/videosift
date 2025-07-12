// Debug script to test channel processing endpoint
const channelUrl = process.argv[2];

if (!channelUrl) {
  console.log('Usage: node debug-channel-process.js <youtube-channel-url>');
  process.exit(1);
}

async function testChannelProcess() {
  try {
    console.log('🔍 Testing channel process endpoint...');
    console.log('Channel URL:', channelUrl);
    
    const response = await fetch('http://localhost:3000/api/channel/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add your Clerk auth token here
        // 'Authorization': 'Bearer YOUR_CLERK_TOKEN'
      },
      body: JSON.stringify({ channelUrl })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Success:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error response');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testChannelProcess();