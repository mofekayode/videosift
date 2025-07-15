import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    console.log('🔍 Testing email configuration...');
    console.log('API Key exists:', !!resendApiKey);
    console.log('API Key length:', resendApiKey?.length);
    console.log('API Key prefix:', resendApiKey?.substring(0, 10) + '...');
    
    if (!resendApiKey) {
      return NextResponse.json({
        error: 'RESEND_API_KEY not configured',
        envVars: Object.keys(process.env).filter(key => key.includes('RESEND'))
      }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    
    // Try to send a test email
    console.log('📧 Sending test email...');
    const result = await resend.emails.send({
      from: 'VidSift <onboarding@resend.dev>',
      to: 'mofekayode@gmail.com', // Using the verified email for Resend test mode
      subject: 'Test Email from VidSift',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify that email sending is working correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <p><strong>Note:</strong> In test mode, Resend only allows sending to mofekayode@gmail.com</p>
      `
    });

    console.log('📧 Full Resend response:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      result: {
        data: result.data,
        error: result.error,
        hasData: !!result.data,
        hasError: !!result.error
      },
      apiKeyInfo: {
        exists: true,
        length: resendApiKey.length,
        prefix: resendApiKey.substring(0, 10)
      }
    });

  } catch (error) {
    console.error('❌ Test email error:', error);
    
    return NextResponse.json({
      error: 'Failed to send test email',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}