import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY environment variable not set',
        configured: false
      });
    }

    if (apiKey.startsWith('re_')) {
      console.log('✅ Resend API key is properly formatted');
    } else {
      console.log('⚠️ Resend API key format looks incorrect');
    }

    // Test the Resend client
    const resend = new Resend(apiKey);
    
    console.log('🧪 Testing Resend configuration...');
    
    // Try to send a simple test email
    const result = await resend.emails.send({
      from: 'MindSift <onboarding@resend.dev>',
      to: 'mofekayode@gmail.com',
      subject: '🧪 MindSift Email Test',
      html: `
        <div style="padding: 20px; font-family: system-ui;">
          <h2>Email Test Successful!</h2>
          <p>This is a test email from MindSift to verify the email configuration is working properly.</p>
          <p>Time: ${new Date().toISOString()}</p>
        </div>
      `
    });

    console.log('📧 Resend API Response:', result);

    return NextResponse.json({
      success: true,
      message: 'Email test completed',
      apiKeyConfigured: !!apiKey,
      apiKeyFormat: apiKey?.substring(0, 8) + '...',
      result: result
    });

  } catch (error) {
    console.error('❌ Resend test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}