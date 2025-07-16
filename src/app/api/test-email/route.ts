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
      from: 'VidSift <noreply@vidsift.com>',
      to: 'mofe@prepproof.com', // Testing production mode
      subject: 'Test Email from VidSift - Production Mode Test',
      html: `
        <h1>Production Mode Test Email</h1>
        <p>This is a test email to verify that Resend is now in production mode.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <p>If you receive this email at mofe@prepproof.com, it means Resend is successfully configured in production mode!</p>
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