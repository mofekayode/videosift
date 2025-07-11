import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ChannelProcessingEmailData {
  userEmail: string;
  userName: string;
  channelTitle: string;
  channelUrl: string;
  videosProcessed: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

export async function sendChannelProcessingNotification(data: ChannelProcessingEmailData) {
  try {
    console.log(`📧 Sending email notification to ${data.userEmail} for channel: ${data.channelTitle}`);

    const subject = data.status === 'completed' 
      ? `✅ Channel "${data.channelTitle}" is ready for chat!`
      : `❌ Channel "${data.channelTitle}" processing failed`;

    const emailContent = data.status === 'completed' 
      ? getSuccessEmailContent(data)
      : getFailureEmailContent(data);

    const result = await resend.emails.send({
      from: 'MindSift <onboarding@resend.dev>',
      to: data.userEmail,
      subject,
      html: emailContent
    });

    console.log('✅ Email sent successfully:', result.data?.id);
    return { success: true, id: result.data?.id };

  } catch (error) {
    console.error('❌ Failed to send email:', error);
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
      <title>Channel Ready - MindSift</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
        .stats { background: #f1f5f9; padding: 16px; border-radius: 6px; margin: 16px 0; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">🎉 Channel Ready!</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Your YouTube channel has been successfully indexed</p>
        </div>
        
        <div class="content">
          <p>Hi ${data.userName || 'there'},</p>
          
          <p>Great news! Your YouTube channel <strong>"${data.channelTitle}"</strong> has been successfully processed and is now ready for AI-powered conversations.</p>
          
          <div class="stats">
            <h3 style="margin: 0 0 8px 0; color: #1e293b;">Processing Summary</h3>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
              <li><strong>${data.videosProcessed}</strong> videos indexed</li>
              <li>Full transcripts downloaded and processed</li>
              <li>Ready for intelligent chat queries</li>
            </ul>
          </div>
          
          <p>You can now chat with all videos from this channel using our AI assistant. Ask questions about any video content, get summaries, or explore topics across the entire channel.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://mindsift.ai'}" class="button">
              Start Chatting with Your Channel
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
            <strong>What's next?</strong> Head to MindSift, select your indexed channel, and start asking questions about your video content. Our AI will search across all ${data.videosProcessed} videos to give you comprehensive answers with precise timestamps.
          </p>
        </div>
        
        <div class="footer">
          <p>Thanks for using MindSift!</p>
          <p>If you have any questions, just reply to this email.</p>
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
      <title>Channel Processing Failed - MindSift</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px; margin: 16px 0; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
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
          
          <p>In the meantime, you can still use MindSift with individual video URLs. Just paste any YouTube video link and start chatting!</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://mindsift.ai'}" class="button">
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
      from: 'MindSift <onboarding@resend.dev>',
      to: userEmail,
      subject: '🎉 Welcome to MindSift - Your AI YouTube Assistant!',
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
      <title>Welcome to MindSift</title>
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
          <h1 style="margin: 0; font-size: 28px;">Welcome to MindSift!</h1>
          <p style="margin: 12px 0 0 0; opacity: 0.9; font-size: 18px;">Your AI-powered YouTube assistant</p>
        </div>
        
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          
          <p>Thanks for joining MindSift! You now have access to the most powerful way to interact with YouTube content using AI.</p>
          
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
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://mindsift.ai'}" class="button">
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