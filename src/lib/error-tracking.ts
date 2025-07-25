import { supabase } from './supabase';
import { sendErrorNotification } from './email';

export enum ErrorCategory {
  API_ERROR = 'api_error',
  AUTH_ERROR = 'auth_error', 
  DATABASE_ERROR = 'database_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  USER_INPUT_ERROR = 'user_input_error',
  SYSTEM_ERROR = 'system_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  VALIDATION_ERROR = 'validation_error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  videoId?: string;
  channelId?: string;
  apiEndpoint?: string;
  userAgent?: string;
  ipAddress?: string;
  requestBody?: any;
  responseStatus?: number;
  additionalData?: Record<string, any>;
}

export interface ErrorEvent {
  id?: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  stack?: string;
  context?: ErrorContext;
  timestamp: string;
  resolved: boolean;
  occurrence_count: number;
}

class ErrorTracker {
  private static instance: ErrorTracker;
  private errorQueue: ErrorEvent[] = [];
  private isProcessing = false;
  private maxQueueSize = 100;
  private flushInterval = 30000; // 30 seconds
  private emailThrottle = new Map<string, number>(); // Prevent email spam

  private constructor() {
    // Flush errors periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.flushErrors(), this.flushInterval);
      
      // Flush on page unload
      window.addEventListener('beforeunload', () => this.flushErrors());
      
      // Global error handlers
      window.addEventListener('error', (event) => {
        this.trackError({
          message: event.message,
          category: ErrorCategory.SYSTEM_ERROR,
          severity: ErrorSeverity.HIGH,
          stack: event.error?.stack,
          context: {
            additionalData: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno
            }
          }
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.trackError({
          message: `Unhandled Promise Rejection: ${event.reason}`,
          category: ErrorCategory.SYSTEM_ERROR,
          severity: ErrorSeverity.HIGH,
          stack: event.reason?.stack,
          context: {
            additionalData: {
              reason: event.reason
            }
          }
        });
      });
    }
  }

  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  public trackError(error: Omit<ErrorEvent, 'id' | 'timestamp' | 'resolved' | 'occurrence_count'>): void {
    const errorEvent: ErrorEvent = {
      ...error,
      timestamp: new Date().toISOString(),
      resolved: false,
      occurrence_count: 1
    };

    // Add to queue
    this.errorQueue.push(errorEvent);

    // Log to console in development AND production temporarily
    console.error('🚨 Error tracked:', errorEvent);
    console.error('Error details:', {
      id: errorEvent.id,
      message: error.message,
      stack: error.stack,
      metadata: error.metadata
    });

    // Send email notification for critical errors
    if (this.shouldSendErrorEmail(error)) {
      this.sendErrorEmail(error);
    }

    // Flush immediately for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.flushErrors();
    }

    // Prevent queue overflow
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize);
    }
  }

  private shouldSendErrorEmail(error: Omit<ErrorEvent, 'id' | 'timestamp' | 'resolved' | 'occurrence_count'>): boolean {
    // Only send emails on server-side
    if (typeof window !== 'undefined') {
      return false;
    }

    // Send email for critical and high severity errors
    if (error.severity !== ErrorSeverity.CRITICAL && error.severity !== ErrorSeverity.HIGH) {
      return false;
    }

    // Throttle emails to prevent spam (1 email per error type per hour)
    const throttleKey = `${error.category}-${error.message.substring(0, 50)}`;
    const lastSent = this.emailThrottle.get(throttleKey);
    const now = Date.now();
    
    if (lastSent && (now - lastSent) < 3600000) { // 1 hour
      return false;
    }

    this.emailThrottle.set(throttleKey, now);
    return true;
  }

  private async sendErrorEmail(error: Omit<ErrorEvent, 'id' | 'timestamp' | 'resolved' | 'occurrence_count'>): Promise<void> {
    try {
      await sendErrorNotification(
        {
          message: error.message,
          type: error.category,
          stack: error.stack
        },
        {
          severity: error.severity,
          ...error.context
        }
      );
    } catch (emailError) {
      console.error('Failed to send error email notification:', emailError);
    }
  }

  public async flushErrors(): Promise<void> {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const errorsToFlush = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // Group similar errors to reduce noise
      const groupedErrors = this.groupSimilarErrors(errorsToFlush);
      
      // Save to database
      const { error } = await supabase
        .from('error_logs')
        .insert(groupedErrors);

      if (error) {
        console.error('Failed to save error logs:', error);
        // Put errors back in queue for retry
        this.errorQueue.unshift(...errorsToFlush);
      }
    } catch (error) {
      console.error('Error while flushing error logs:', error);
      // Put errors back in queue for retry
      this.errorQueue.unshift(...errorsToFlush);
    } finally {
      this.isProcessing = false;
    }
  }

  private groupSimilarErrors(errors: ErrorEvent[]): ErrorEvent[] {
    const grouped = new Map<string, ErrorEvent>();

    for (const error of errors) {
      // Create a key based on message and category
      const key = `${error.category}:${error.message}`;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.occurrence_count += 1;
        // Keep the most recent timestamp
        if (error.timestamp > existing.timestamp) {
          existing.timestamp = error.timestamp;
          existing.context = error.context;
        }
      } else {
        grouped.set(key, { ...error });
      }
    }

    return Array.from(grouped.values());
  }

  public async getErrorStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    trends: Array<{ date: string; count: number; }>;
  }> {
    try {
      const now = new Date();
      const startTime = new Date();
      
      switch (timeframe) {
        case 'hour':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case 'day':
          startTime.setDate(startTime.getDate() - 1);
          break;
        case 'week':
          startTime.setDate(startTime.getDate() - 7);
          break;
      }

      const { data: errors, error } = await supabase
        .from('error_logs')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', now.toISOString());

      if (error) {
        throw error;
      }

      const total = errors?.reduce((sum, err) => sum + err.occurrence_count, 0) || 0;
      
      const byCategory = Object.values(ErrorCategory).reduce((acc, category) => {
        acc[category] = errors?.filter(e => e.category === category)
          .reduce((sum, err) => sum + err.occurrence_count, 0) || 0;
        return acc;
      }, {} as Record<ErrorCategory, number>);

      const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
        acc[severity] = errors?.filter(e => e.severity === severity)
          .reduce((sum, err) => sum + err.occurrence_count, 0) || 0;
        return acc;
      }, {} as Record<ErrorSeverity, number>);

      // Simple daily trends for now
      const trends = [{ date: now.toISOString().split('T')[0], count: total }];

      return { total, byCategory, bySeverity, trends };
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        total: 0,
        byCategory: {} as Record<ErrorCategory, number>,
        bySeverity: {} as Record<ErrorSeverity, number>,
        trends: []
      };
    }
  }
}

// Singleton instance
export const errorTracker = ErrorTracker.getInstance();

// Convenience functions
export function trackApiError(
  message: string, 
  context: ErrorContext, 
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): void {
  errorTracker.trackError({
    message,
    category: ErrorCategory.API_ERROR,
    severity,
    context
  });
}

export function trackDatabaseError(
  message: string, 
  context: ErrorContext, 
  severity: ErrorSeverity = ErrorSeverity.HIGH
): void {
  errorTracker.trackError({
    message,
    category: ErrorCategory.DATABASE_ERROR,
    severity,
    context
  });
}

export function trackAuthError(
  message: string, 
  context: ErrorContext, 
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): void {
  errorTracker.trackError({
    message,
    category: ErrorCategory.AUTH_ERROR,
    severity,
    context
  });
}

export function trackExternalServiceError(
  message: string, 
  context: ErrorContext, 
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): void {
  errorTracker.trackError({
    message,
    category: ErrorCategory.EXTERNAL_SERVICE_ERROR,
    severity,
    context
  });
}

export function trackUserInputError(
  message: string, 
  context: ErrorContext, 
  severity: ErrorSeverity = ErrorSeverity.LOW
): void {
  errorTracker.trackError({
    message,
    category: ErrorCategory.USER_INPUT_ERROR,
    severity,
    context
  });
}

export function trackRateLimitError(
  message: string, 
  context: ErrorContext, 
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): void {
  errorTracker.trackError({
    message,
    category: ErrorCategory.RATE_LIMIT_ERROR,
    severity,
    context
  });
}

// Wrapper for async functions with automatic error tracking
export function withErrorTracking<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorContext?: Partial<ErrorContext>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      
      errorTracker.trackError({
        message: errorMessage,
        category: ErrorCategory.SYSTEM_ERROR,
        severity: ErrorSeverity.HIGH,
        stack,
        context: errorContext
      });
      
      throw error;
    }
  };
}