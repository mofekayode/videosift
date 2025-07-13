// Run this in the browser console on http://localhost:3001

async function testChannelChat() {
  console.log('🧪 Testing Channel Chat with Video References\n');
  
  try {
    const response = await fetch('/api/chat-channel-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: '13f079a2-1446-46a7-adba-3a9660e36765', // Exponent channel
        message: 'What interview strategies are discussed across the different videos?',
        sessionId: null
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:');
    console.log('- Session ID:', response.headers.get('X-Session-ID'));
    console.log('- Channel Title:', response.headers.get('X-Channel-Title'));
    
    if (response.ok) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      console.log('\n📝 Streaming response:');
      console.log('-'.repeat(50));
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        console.log(chunk);
      }
      
      console.log('-'.repeat(50));
      
      // Check for video references in response
      const videoRefPattern = /In the video ['"](.+?)['"]/g;
      const timestampPattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
      
      const videoRefs = new Set();
      const timestamps = [];
      
      let match;
      while ((match = videoRefPattern.exec(fullResponse)) !== null) {
        videoRefs.add(match[1]);
      }
      
      while ((match = timestampPattern.exec(fullResponse)) !== null) {
        timestamps.push(match[1]);
      }
      
      console.log('\n📊 Analysis:');
      console.log(`- Videos referenced: ${videoRefs.size}`);
      if (videoRefs.size > 0) {
        console.log('  Referenced videos:');
        videoRefs.forEach(title => console.log(`    • ${title}`));
      }
      console.log(`- Timestamps cited: ${timestamps.length}`);
      if (timestamps.length > 0) {
        console.log('  Timestamps:', timestamps.join(', '));
      }
      
    } else {
      const error = await response.json();
      console.error('❌ Error:', error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testChannelChat();