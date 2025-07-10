'use client';

import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />
  );
}

interface LoadingCardProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingCard({ title = 'Loading...', description, className }: LoadingCardProps) {
  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" className="mx-auto" />
          <div>
            <p className="font-medium">{title}</p>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ value, max = 100, className, showPercentage = false }: ProgressBarProps) {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        {showPercentage && (
          <span className="text-sm font-medium">{percentage}%</span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ProcessingStepsProps {
  steps: Array<{
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    description?: string;
  }>;
  className?: string;
}

export function ProcessingSteps({ steps, className }: ProcessingStepsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {step.status === 'completed' && (
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            {step.status === 'active' && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <LoadingSpinner size="sm" className="text-primary-foreground" />
              </div>
            )}
            {step.status === 'error' && (
              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            {step.status === 'pending' && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-muted-foreground/20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium',
              step.status === 'completed' && 'text-green-600',
              step.status === 'error' && 'text-red-600',
              step.status === 'active' && 'text-primary',
              step.status === 'pending' && 'text-muted-foreground'
            )}>
              {step.label}
            </p>
            {step.description && (
              <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}