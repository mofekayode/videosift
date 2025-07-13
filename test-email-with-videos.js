const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testEmailWithVideos() {
  console.log('🧪 Testing channel processing email with correct video count\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/debug/send-test-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'channel-success',
        email: 'test@example.com' // Replace with your email to test
      })
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📧 Check your inbox for the channel processing notification');
      console.log('📊 The email should show 3 videos processed');
    } else {
      console.error('❌ Failed to send test email:', data.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testEmailWithVideos();