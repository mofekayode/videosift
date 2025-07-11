'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { errorTracker, ErrorCategory, ErrorSeverity } from '@/lib/error-tracking';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString()
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Track the error
    errorTracker.trackError({
      message: error.message,
      category: ErrorCategory.SYSTEM_ERROR,
      severity: ErrorSeverity.HIGH,
      stack: error.stack,
      context: {
        additionalData: {
          errorInfo: errorInfo.componentStack,
          errorBoundary: true
        }
      }
    });

    console.error('Error caught by boundary:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                <p>We encountered an unexpected error. Our team has been notified.</p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer font-medium">Error Details</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {this.state.error.message}
                      {this.state.error.stack && (
                        <>
                          {'\n\n'}
                          {this.state.error.stack}
                        </>
                      )}
                    </pre>
                  </details>
                )}
                {this.state.errorId && (
                  <p className="mt-2 text-xs font-mono">
                    Error ID: {this.state.errorId}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleRetry} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome} size="sm">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: { [key: string]: any }) => {
    errorTracker.trackError({
      message: error.message,
      category: ErrorCategory.SYSTEM_ERROR,
      severity: ErrorSeverity.MEDIUM,
      stack: error.stack,
      context: {
        additionalData: errorInfo
      }
    });
  };
}