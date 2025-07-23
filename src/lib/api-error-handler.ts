import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserInfo } from './auth-helpers';
import { sendErrorNotification } from './email';
import { ErrorSeverity, trackApiError } from './error-tracking';

export interface ApiError extends Error {
  statusCode?: number;
  severity?: ErrorSeverity;
  context?: any;
}

export async function withErrorHandler(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options?: {
    apiEndpoint?: string;
    requireAuth?: boolean;
  }
) {
  return async (request: NextRequest) => {
    try {
      // Get user information
      const userInfo = await getCurrentUserInfo();
      
      // If auth is required and no user, return 401
      if (options?.requireAuth && !userInfo) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Call the actual handler
      return await handler(request);
      
    } catch (error: any) {
      // Get user information for error context
      const userInfo = await getCurrentUserInfo();
      
      const apiError = error as ApiError;
      const statusCode = apiError.statusCode || 500;
      const severity = apiError.severity || ErrorSeverity.HIGH;
      
      const errorContext = {
        apiEndpoint: options?.apiEndpoint || request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        timestamp: new Date().toISOString(),
        userInfo: userInfo ? {
          userId: userInfo.userId,
          email: userInfo.email,
          name: userInfo.name,
          supabaseId: userInfo.supabaseId
        } : undefined,
        ...apiError.context
      };

      // Track the error
      trackApiError(
        apiError.message || 'Unknown API error',
        errorContext,
        severity
      );

      // Send error notification email for high/critical errors
      if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
        try {
          await sendErrorNotification(error, errorContext);
        } catch (emailError) {
          console.error('Failed to send error notification email:', emailError);
        }
      }

      // Return error response
      return NextResponse.json(
        {
          error: apiError.message || 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && {
            stack: apiError.stack,
            context: errorContext
          })
        },
        { status: statusCode }
      );
    }
  };
}

// Helper to create API errors with proper context
export function createApiError(
  message: string,
  statusCode: number = 500,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.severity = severity;
  error.context = context;
  return error;
}