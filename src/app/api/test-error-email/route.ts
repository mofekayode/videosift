import { NextRequest, NextResponse } from 'next/server';
import { sendErrorNotification } from '@/lib/email';
import { ErrorSeverity, trackApiError } from '@/lib/error-tracking';
import { getCurrentUserInfo } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Check for admin access (you can add proper auth later)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer test-error-email-secret') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user information
    const userInfo = await getCurrentUserInfo();

    // Create a test error
    const testError = new Error('Test error: This is a test of the error email notification system');
    testError.name = 'TestError';
    testError.stack = `Error: Test error: This is a test of the error email notification system
    at testErrorEmail (/app/api/test-error-email/route.ts:10:20)
    at NextRequest.GET (/app/api/test-error-email/route.ts:5:15)
    at processRequest (node_modules/next/server.js:123:45)`;

    const context = {
      apiEndpoint: '/api/test-error-email',
      userAgent: request.headers.get('user-agent') || 'Unknown',
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      timestamp: new Date().toISOString(),
      userInfo: userInfo ? {
        userId: userInfo.userId,
        email: userInfo.email,
        name: userInfo.name,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        username: userInfo.username,
        supabaseId: userInfo.supabaseId
      } : {
        userId: 'anonymous',
        email: 'not-logged-in@example.com',
        name: 'Anonymous User'
      },
      additionalData: {
        testType: 'manual',
        environment: process.env.NODE_ENV,
        purpose: 'Testing error email notifications'
      }
    };

    // Track the error (this will also send email if configured)
    trackApiError(
      testError.message,
      context,
      ErrorSeverity.HIGH
    );

    // Also send email directly to ensure it works
    const emailResult = await sendErrorNotification(testError, {
      severity: ErrorSeverity.HIGH,
      ...context
    });

    return NextResponse.json({
      success: true,
      message: 'Test error email triggered',
      details: {
        errorMessage: testError.message,
        errorType: testError.name,
        context,
        emailSent: true,
        timestamp: new Date().toISOString(),
        userInfo: userInfo ? 'User information included' : 'No user logged in'
      }
    });

  } catch (error) {
    console.error('Failed to send test error email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test error email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for admin access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer test-error-email-secret') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get custom error details from request body
    const body = await request.json();
    const {
      message = 'Custom test error from API',
      type = 'CustomTestError',
      severity = 'high',
      includeStack = true
    } = body;

    // Create custom error
    const customError = new Error(message);
    customError.name = type;
    
    if (includeStack) {
      customError.stack = `Error: ${message}
    at customErrorTest (/app/api/test-error-email/route.ts:50:20)
    at NextRequest.POST (/app/api/test-error-email/route.ts:45:15)
    at processRequest (node_modules/next/server.js:123:45)
    at async Server.handleRequest (node_modules/next/server.js:456:78)`;
    }

    const context = {
      apiEndpoint: '/api/test-error-email',
      method: 'POST',
      userId: body.userId || 'test-user-custom',
      sessionId: body.sessionId || 'test-session-custom',
      userAgent: request.headers.get('user-agent') || 'Unknown',
      timestamp: new Date().toISOString(),
      requestBody: body,
      additionalData: {
        testType: 'custom',
        environment: process.env.NODE_ENV
      }
    };

    // Send error notification
    const emailResult = await sendErrorNotification(customError, {
      severity: severity as ErrorSeverity,
      ...context
    });

    return NextResponse.json({
      success: true,
      message: 'Custom error email sent',
      details: {
        errorMessage: customError.message,
        errorType: customError.name,
        severity,
        context,
        emailSent: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to send custom error email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send custom error email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}