import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail, sendChannelProcessingNotification } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const testEmail = 'mofekayode@gmail.com';
    const testUserName = 'Mofe';
    
    console.log('📧 Sending test emails to:', testEmail);
    
    // Send welcome email
    console.log('1. Sending welcome email...');
    const welcomeResult = await sendWelcomeEmail(testEmail, testUserName);
    
    // Send success email
    console.log('2. Sending channel success email...');
    const successResult = await sendChannelProcessingNotification({
      userEmail: testEmail,
      userName: testUserName,
      channelTitle: 'AI Explained',
      channelUrl: 'https://youtube.com/@ai-explained-',
      videosProcessed: 127,
      status: 'completed'
    });
    
    // Send failure email
    console.log('3. Sending channel failure email...');
    const failureResult = await sendChannelProcessingNotification({
      userEmail: testEmail,
      userName: testUserName,
      channelTitle: 'Tech Tutorials Channel',
      channelUrl: 'https://youtube.com/@techtutorials',
      videosProcessed: 0,
      status: 'failed',
      errorMessage: 'Channel has too many videos (500+ limit exceeded). Processing will be attempted in smaller batches.'
    });
    
    console.log('✅ All test emails sent successfully');
    
    return NextResponse.json({
      success: true,
      message: 'All 3 test emails sent successfully',
      results: {
        welcome: welcomeResult,
        success: successResult,
        failure: failureResult
      },
      sentTo: testEmail
    });
    
  } catch (error) {
    console.error('❌ Error sending test emails:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}