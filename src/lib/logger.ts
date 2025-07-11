export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error'
}

export enum LogCategory {
  API = 'api',
  AUTH = 'auth',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  USER_ACTION = 'user_action',
  SYSTEM = 'system',
  PERFORMANCE = 'performance',
  SECURITY = 'security'
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  videoId?: string;
  channelId?: string;
  duration?: number;
  apiEndpoint?: string;
  httpStatus?: number;
  userAgent?: string;
  ipAddress?: string;
  additionalData?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logQueue: LogEntry[] = [];
  private isProcessing = false;
  private maxQueueSize = 200;
  private flushInterval = 30000; // 30 seconds

  private constructor() {
    // Auto-flush logs periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.flushLogs(), this.flushInterval);
      window.addEventListener('beforeunload', () => this.flushLogs());
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, category: LogCategory, message: string, context?: LogContext): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context
    };

    // Add to queue
    this.logQueue.push(logEntry);

    // Console logging based on environment and level
    this.consoleLog(logEntry);

    // Prevent queue overflow
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue = this.logQueue.slice(-this.maxQueueSize);
    }

    // Auto-flush for error level logs
    if (level === LogLevel.ERROR) {
      this.flushLogs();
    }
  }

  private consoleLog(entry: LogEntry): void {
    const isDev = process.env.NODE_ENV === 'development';
    const emoji = this.getLevelEmoji(entry.level);
    const categoryTag = `[${entry.category.toUpperCase()}]`;
    
    const logMessage = `${emoji} ${categoryTag} ${entry.message}`;
    const contextData = entry.context ? { context: entry.context } : {};

    switch (entry.level) {
      case LogLevel.DEBUG:
        if (isDev) console.debug(logMessage, contextData);
        break;
      case LogLevel.INFO:
        console.info(logMessage, contextData);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, contextData);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, contextData);
        if (entry.stack) console.error('Stack:', entry.stack);
        break;
    }
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return 'ℹ️';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      default: return '📝';
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const logsToFlush = [...this.logQueue];
    this.logQueue = [];

    try {
      // In production, send logs to your logging service
      // For now, we'll just store critical logs in Supabase
      const criticalLogs = logsToFlush.filter(log => 
        log.level === LogLevel.ERROR || log.level === LogLevel.WARN
      );

      if (criticalLogs.length > 0) {
        // You can uncomment this when you have a logs table
        // const { error } = await supabase
        //   .from('logs')
        //   .insert(criticalLogs);
        
        // if (error) {
        //   console.error('Failed to save logs:', error);
        // }
      }

      // For development, log the flush
      if (process.env.NODE_ENV === 'development') {
        console.debug(`📋 Flushed ${logsToFlush.length} logs`);
      }
    } catch (error) {
      console.error('Error while flushing logs:', error);
      // Put logs back in queue for retry
      this.logQueue.unshift(...logsToFlush);
    } finally {
      this.isProcessing = false;
    }
  }

  // Public logging methods
  public debug(category: LogCategory, message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  public info(category: LogCategory, message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  public warn(category: LogCategory, message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  public error(category: LogCategory, message: string, context?: LogContext, error?: Error): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category,
      message,
      context,
      stack: error?.stack
    };
    
    this.logQueue.push(logEntry);
    this.consoleLog(logEntry);
    this.flushLogs(); // Immediate flush for errors
  }

  // Performance logging
  public startTimer(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.info(LogCategory.PERFORMANCE, `Timer: ${name}`, { duration });
    };
  }

  // API request logging
  public logApiRequest(
    method: string,
    endpoint: string,
    status: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = status >= 400 ? LogLevel.ERROR : status >= 300 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, LogCategory.API, `${method} ${endpoint} - ${status}`, {
      ...context,
      httpStatus: status,
      duration,
      apiEndpoint: endpoint
    });
  }

  // User action logging
  public logUserAction(action: string, context?: LogContext): void {
    this.info(LogCategory.USER_ACTION, action, context);
  }

  // Security event logging
  public logSecurityEvent(event: string, context?: LogContext): void {
    this.warn(LogCategory.SECURITY, event, context);
  }
}

// Singleton instance
export const logger = Logger.getInstance();

// Convenience functions
export function logApiRequest(
  method: string,
  endpoint: string,
  status: number,
  duration: number,
  context?: LogContext
): void {
  logger.logApiRequest(method, endpoint, status, duration, context);
}

export function logUserAction(action: string, context?: LogContext): void {
  logger.logUserAction(action, context);
}

export function logError(message: string, error?: Error, context?: LogContext): void {
  logger.error(LogCategory.SYSTEM, message, context, error);
}

export function logInfo(message: string, context?: LogContext): void {
  logger.info(LogCategory.SYSTEM, message, context);
}

export function logWarn(message: string, context?: LogContext): void {
  logger.warn(LogCategory.SYSTEM, message, context);
}

export function logDebug(message: string, context?: LogContext): void {
  logger.debug(LogCategory.SYSTEM, message, context);
}

// Performance timing decorator
export function logPerformance<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  name: string,
  context?: LogContext
) {
  return async (...args: T): Promise<R> => {
    const stopTimer = logger.startTimer(name);
    try {
      const result = await fn(...args);
      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      logger.error(LogCategory.PERFORMANCE, `Performance timing failed for ${name}`, context, error as Error);
      throw error;
    }
  };
}