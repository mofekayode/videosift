import { Resend } from 'resend';
import { ErrorSeverity } from './error-tracking';

// Initialize Resend with error handling
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.warn('⚠️ RESEND_API_KEY is not set in environment variables');
}

const resend = new Resend(resendApiKey || 'dummy-key-for-build');

export interface ChannelProcessingEmailData {
  userEmail: string;
  userName: string;
  channelTitle: string;
  channelUrl: string;
  videosProcessed: number;
  totalVideos?: number;
  existingVideos?: number;
  noTranscriptVideos?: number;
  failedVideos?: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

export async function sendChannelProcessingNotification(data: ChannelProcessingEmailData) {
  try {
    console.log(`📧 Sending email notification to ${data.userEmail} for channel: ${data.channelTitle}`);

    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const subject = data.status === 'completed' 
      ? `✅ Channel "${data.channelTitle}" is ready for chat!`
      : `❌ Channel "${data.channelTitle}" processing failed`;

    const emailContent = data.status === 'completed' 
      ? getSuccessEmailContent(data)
      : getFailureEmailContent(data);

    console.log('📧 Attempting to send email with Resend...');
    const result = await resend.emails.send({
      from: 'VidSift <noreply@vidsift.com>',
      to: data.userEmail,
      subject,
      html: emailContent
    });

    // Log the full result for debugging
    console.log('📧 Email API Response:', {
      hasData: !!result.data,
      hasError: !!result.error,
      data: result.data,
      error: result.error
    });
    
    // Check if there was an error
    if (result.error) {
      console.error('❌ Resend API error:', result.error);
      return { success: false, error: result.error.message || 'Email send failed' };
    }
    
    // The correct way to access Resend response
    const emailId = result.data?.id || 'sent';
    console.log('✅ Email sent successfully with ID:', emailId);
    
    return { success: true, id: emailId };

  } catch (error) {
    console.error('❌ Failed to send email - Exception:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getSuccessEmailContent(data: ChannelProcessingEmailData): string {
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Channel Ready - VidSift</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #f3f4f6; color: #0f172a; padding: 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb; }
        .content { padding: 32px 24px; }
        .button { display: inline-block; background: #0f172a; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .stats { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; }
        .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { color: #64748b; font-size: 14px; }
        .stat-value { font-weight: 600; color: #0f172a; font-size: 16px; }
        .success-value { color: #059669; }
        .warning-value { color: #d97706; }
        .info-value { color: #3b82f6; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        .warning-box { background: #fef3c7; border: 1px solid #fbbf24; color: #92400e; padding: 16px; border-radius: 6px; margin: 16px 0; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #0f172a;">Channel Ready! 🎉</h1>
          <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9; color: #475569;">Your YouTube channel has been successfully indexed</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; line-height: 1.6;">Hi ${data.userName || 'there'},</p>
          
          <p style="font-size: 16px; line-height: 1.6;">Great news! Your YouTube channel <strong>"${data.channelTitle}"</strong> has been processed and is now ready for AI-powered conversations.</p>
          
          <div class="stats">
            <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px;">Processing Summary</h3>
            <div class="stat-row">
              <span class="stat-label">Videos Successfully Indexed</span>
              <span class="stat-value success-value"> ${data.videosProcessed}</span>
            </div>
            ${data.totalVideos && data.totalVideos > 0 ? `
            <div class="stat-row">
              <span class="stat-label">Total Videos Found</span>
              <span class="stat-value"> ${data.totalVideos}</span>
            </div>
            ` : ''}
            ${data.noTranscriptVideos && data.noTranscriptVideos > 0 ? `
            <div class="stat-row">
              <span class="stat-label">No Captions Available</span>
              <span class="stat-value warning-value">${data.noTranscriptVideos}</span>
            </div>
            ` : ''}
            ${data.existingVideos && data.existingVideos > 0 ? `
            <div class="stat-row">
              <span class="stat-label">Already Indexed</span>
              <span class="stat-value info-value">${data.existingVideos}</span>
            </div>
            ` : ''}
          </div>
          
          ${data.noTranscriptVideos ? `
          <div class="warning-box">
            <strong>ℹ️ Note:</strong> ${data.noTranscriptVideos} video${data.noTranscriptVideos > 1 ? 's' : ''} couldn't be indexed because ${data.noTranscriptVideos > 1 ? 'they don\'t' : 'it doesn\'t'} have captions available. This is normal for videos without closed captions.
          </div>
          ` : ''}
          
          <p style="font-size: 16px; line-height: 1.6;">You can now chat with your YouTube channel! Ask questions, get summaries, or explore topics across all ${data.videosProcessed} indexed videos.</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vidsift.com'}/dashboard?tab=channels" class="button">
              Start Chatting with Your Channel
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 24px; line-height: 1.6;">
            <strong>What's next?</strong> Head to VidSift, select your indexed channel, and start asking questions about your video content. Our AI will search across all ${data.videosProcessed} indexed videos to give you comprehensive answers with precise timestamps.
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 8px 0;">Thanks for using VidSift!</p>
          <p style="margin: 0;">If you have any questions, just reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getFailureEmailContent(data: ChannelProcessingEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Channel Processing Failed - VidSift</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .button { display: inline-block; background: #0f172a; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px; margin: 16px 0; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Processing Failed</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">We encountered an issue processing your channel</p>
        </div>
        
        <div class="content">
          <p>Hi ${data.userName || 'there'},</p>
          
          <p>We encountered an issue while processing your YouTube channel <strong>"${data.channelTitle}"</strong>. Don't worry - our team has been notified and we're looking into it.</p>
          
          ${data.errorMessage ? `
            <div class="error-box">
              <h4 style="margin: 0 0 8px 0; color: #dc2626;">Error Details</h4>
              <p style="margin: 0; color: #7f1d1d; font-family: monospace; font-size: 14px;">${data.errorMessage}</p>
            </div>
          ` : ''}
          
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>Our technical team will investigate the issue</li>
            <li>We'll attempt to reprocess your channel automatically</li>
            <li>You'll receive another email once it's resolved</li>
          </ul>
          
          <p>In the meantime, you can still use VidSift with individual video URLs. Just paste any YouTube video link and start chatting!</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vidsift.com'}" class="button">
              Try with Individual Videos
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p>Sorry for the inconvenience. We're working to resolve this quickly!</p>
          <p>Questions? Just reply to this email and we'll help you out.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendWelcomeEmail(userEmail: string, userName: string) {
  try {
    console.log(`📧 Sending welcome email to ${userEmail}`);

    const result = await resend.emails.send({
      from: 'VidSift <noreply@vidsift.com>',
      to: userEmail,
      subject: '🎉 Welcome to VidSift - Your AI YouTube Assistant!',
      html: getWelcomeEmailContent(userName)
    });

    console.log('✅ Welcome email sent successfully:', result.data?.id);
    return { success: true, id: result.data?.id };

  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getWelcomeEmailContent(userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to VidSift</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
        .feature { margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 6px; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">Welcome to VidSift!</h1>
          <p style="margin: 12px 0 0 0; opacity: 0.9; font-size: 18px;">Your AI-powered YouTube assistant</p>
        </div>
        
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          
          <p>Thanks for joining VidSift! You now have access to the most powerful way to interact with YouTube content using AI.</p>
          
          <h3 style="color: #1e293b; margin: 24px 0 16px 0;">What you can do:</h3>
          
          <div class="feature">
            <h4 style="margin: 0 0 8px 0; color: #334155;">💬 Chat with any video</h4>
            <p style="margin: 0; color: #64748b;">Paste any YouTube URL and ask questions about the content. Get summaries, key takeaways, or dive deep into specific topics.</p>
          </div>
          
          <div class="feature">
            <h4 style="margin: 0 0 8px 0; color: #334155;">📺 Index entire channels</h4>
            <p style="margin: 0; color: #64748b;">Process whole YouTube channels and search across all videos at once. Perfect for courses, podcasts, or educational content.</p>
          </div>
          
          <div class="feature">
            <h4 style="margin: 0 0 8px 0; color: #334155;">🎯 Precise citations</h4>
            <p style="margin: 0; color: #64748b;">Every answer includes exact timestamps. Click to jump directly to the relevant part of the video.</p>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vidsift.com'}" class="button">
              Start Your First Chat
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px;">
            <strong>Pro tip:</strong> Try asking "Summarize this video" or "What are the key takeaways?" to get started quickly!
          </p>
        </div>
        
        <div class="footer">
          <p>Ready to transform how you consume YouTube content?</p>
          <p>Questions? Just reply to this email - we'd love to help!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Server error notification functions
export async function sendServerErrorNotification(errorData: {
  message: string;
  type?: string;
  stack?: string;
  severity?: ErrorSeverity;
  context?: any;
}) {
  try {
    console.log(`🚨 Sending error notification to admin`);

    // Check if API key exists
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const adminEmail = 'Mofekayode@gmail.com';
    const emailContent = getServerErrorEmailContent(errorData);

    const result = await resend.emails.send({
      from: 'VidSift Alerts <alerts@vidsift.com>',
      to: adminEmail,
      subject: `🚨 Frontend Error: ${errorData.type || 'Unknown Error'}`,
      html: emailContent
    });

    if (result.error) {
      console.error('❌ Failed to send error notification:', result.error);
      return { success: false, error: result.error.message || 'Email send failed' };
    }

    console.log('✅ Error notification sent successfully');
    return { success: true, id: result.data?.id || 'sent' };

  } catch (error: any) {
    console.error('❌ Error notification failed:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

function getServerErrorEmailContent(errorData: any): string {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  
  // Extract user information
  const userInfo = errorData.context?.userInfo || {};
  const hasUserInfo = userInfo.email || userInfo.name || userInfo.userId;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Frontend Error Alert - VidSift</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #dc2626; color: white; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .user-info { background: #dbeafe; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .error-details { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stack-trace { background: #1f2937; color: #10b981; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
        .context-info { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; }
        .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { color: #6b7280; font-size: 14px; }
        .stat-value { font-weight: 600; color: #111827; font-size: 14px; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        .severity-${errorData.severity || 'medium'} { 
          background: ${errorData.severity === 'critical' ? '#991b1b' : errorData.severity === 'high' ? '#dc2626' : '#f59e0b'};
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header severity-${errorData.severity || 'medium'}">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🚨 Frontend Error Alert</h1>
          <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9;">Next.js Application Error</p>
        </div>
        
        <div class="content">
          ${hasUserInfo ? `
          <div class="user-info">
            <h3 style="margin: 0 0 16px 0; color: #1d4ed8; font-size: 20px;">👤 User Information</h3>
            ${userInfo.name ? `<p style="margin: 0 0 8px 0; font-size: 16px; color: #111827;"><strong>Name:</strong> ${userInfo.name}</p>` : ''}
            ${userInfo.email ? `<p style="margin: 0 0 8px 0; font-size: 16px; color: #111827;"><strong>Email:</strong> <a href="mailto:${userInfo.email}">${userInfo.email}</a></p>` : ''}
            ${userInfo.userId ? `<p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>User ID:</strong> ${userInfo.userId}</p>` : ''}
            ${userInfo.supabaseId ? `<p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Supabase ID:</strong> ${userInfo.supabaseId}</p>` : ''}
          </div>
          ` : `
          <div class="user-info" style="background: #fef3c7; border-color: #f59e0b;">
            <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 18px;">👤 User: Anonymous/Not Logged In</h3>
            <p style="margin: 0; font-size: 14px; color: #92400e;">No user information available for this error.</p>
          </div>
          `}

          <div class="error-details">
            <h3 style="margin: 0 0 16px 0; color: #dc2626; font-size: 20px;">${errorData.type || 'Error'}</h3>
            <p style="margin: 0 0 8px 0; font-size: 16px; color: #111827;"><strong>Message:</strong> ${errorData.message || 'Unknown error occurred'}</p>
            <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Time:</strong> ${timestamp}</p>
            <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Environment:</strong> ${environment}</p>
            <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Service:</strong> Frontend (Next.js)</p>
            ${errorData.severity ? `<p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Severity:</strong> ${errorData.severity}</p>` : ''}
          </div>

          ${errorData.context ? `
          <div class="context-info">
            <h4 style="margin: 0 0 12px 0; color: #111827;">Request Context</h4>
            ${errorData.context.apiEndpoint ? `
            <div class="stat-row">
              <span class="stat-label">API Endpoint</span>
              <span class="stat-value">${errorData.context.apiEndpoint}</span>
            </div>
            ` : ''}
            ${errorData.context.ipAddress ? `
            <div class="stat-row">
              <span class="stat-label">IP Address</span>
              <span class="stat-value">${errorData.context.ipAddress}</span>
            </div>
            ` : ''}
            ${errorData.context.sessionId ? `
            <div class="stat-row">
              <span class="stat-label">Session ID</span>
              <span class="stat-value">${errorData.context.sessionId}</span>
            </div>
            ` : ''}
            ${errorData.context.videoId ? `
            <div class="stat-row">
              <span class="stat-label">Video ID</span>
              <span class="stat-value">${errorData.context.videoId}</span>
            </div>
            ` : ''}
            ${errorData.context.channelId ? `
            <div class="stat-row">
              <span class="stat-label">Channel ID</span>
              <span class="stat-value">${errorData.context.channelId}</span>
            </div>
            ` : ''}
            ${errorData.context.userAgent ? `
            <div class="stat-row">
              <span class="stat-label">User Agent</span>
              <span class="stat-value" style="font-size: 12px; word-break: break-all;">${errorData.context.userAgent}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${errorData.stack ? `
          <div style="margin: 20px 0;">
            <h4 style="margin: 0 0 12px 0; color: #111827;">Stack Trace</h4>
            <div class="stack-trace">${errorData.stack}</div>
          </div>
          ` : ''}

          <div style="margin: 32px 0; padding: 20px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px;">
            <h4 style="margin: 0 0 8px 0; color: #92400e;">Action Required</h4>
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              This error occurred in the frontend application. Please check the browser console and server logs for more details.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 8px 0;">VidSift Error Monitoring System</p>
          <p style="margin: 0; font-size: 12px;">This is an automated alert from the frontend application.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to send error notifications from API routes
export async function sendErrorNotification(error: any, context?: any) {
  try {
    await sendServerErrorNotification({
      message: error.message || String(error),
      type: error.name || 'Error',
      stack: error.stack,
      severity: context?.severity || ErrorSeverity.HIGH,
      context
    });
  } catch (emailError) {
    console.error('Failed to send error email:', emailError);
  }
}