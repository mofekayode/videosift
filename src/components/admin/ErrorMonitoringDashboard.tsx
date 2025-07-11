'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Activity, 
  TrendingUp, 
  RefreshCw,
  AlertCircle,
  Info,
  XCircle,
  Clock
} from 'lucide-react';
import { errorTracker, ErrorCategory, ErrorSeverity } from '@/lib/error-tracking';

interface ErrorStats {
  total: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  trends: Array<{ date: string; count: number; }>;
}

export function ErrorMonitoringDashboard() {
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week'>('day');

  const fetchErrorStats = async () => {
    try {
      setIsLoading(true);
      const stats = await errorTracker.getErrorStats(timeframe);
      setErrorStats(stats);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch error stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErrorStats();
    // Refresh every 5 minutes
    const interval = setInterval(fetchErrorStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return <XCircle className="w-4 h-4 text-red-600" />;
      case ErrorSeverity.HIGH:
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case ErrorSeverity.MEDIUM:
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case ErrorSeverity.LOW:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'destructive';
      case ErrorSeverity.HIGH:
        return 'destructive';
      case ErrorSeverity.MEDIUM:
        return 'secondary';
      case ErrorSeverity.LOW:
        return 'outline';
    }
  };

  const getCategoryDisplayName = (category: ErrorCategory) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading && !errorStats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-muted-foreground">Loading error statistics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Error Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            System-wide error tracking and analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as any)}>
            <TabsList>
              <TabsTrigger value="hour">1H</TabsTrigger>
              <TabsTrigger value="day">24H</TabsTrigger>
              <TabsTrigger value="week">7D</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={fetchErrorStats} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last {timeframe === 'hour' ? 'hour' : timeframe === 'day' ? '24 hours' : '7 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {errorStats?.bySeverity[ErrorSeverity.CRITICAL] || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorStats?.byCategory[ErrorCategory.API_ERROR] || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              External API failures
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorStats?.total ? ((errorStats.total / 100) * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Of total requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Errors by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(errorStats?.byCategory || {}).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {getCategoryDisplayName(category as ErrorCategory)}
                  </span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Severity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Errors by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(errorStats?.bySeverity || {}).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(severity as ErrorSeverity)}
                    <span className="text-sm capitalize">
                      {severity.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <Badge variant={getSeverityColor(severity as ErrorSeverity)}>{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Health</CardTitle>
          <p className="text-sm text-muted-foreground">
            Overall system status based on error patterns
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {(() => {
              const criticalErrors = errorStats?.bySeverity[ErrorSeverity.CRITICAL] || 0;
              const totalErrors = errorStats?.total || 0;
              
              if (criticalErrors > 0) {
                return (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <div>
                      <p className="font-medium text-red-600">System Degraded</p>
                      <p className="text-sm text-muted-foreground">
                        {criticalErrors} critical error{criticalErrors !== 1 ? 's' : ''} detected
                      </p>
                    </div>
                  </>
                );
              } else if (totalErrors > 10) {
                return (
                  <>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-yellow-600">Monitoring</p>
                      <p className="text-sm text-muted-foreground">
                        Higher than normal error rate
                      </p>
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-green-600">Healthy</p>
                      <p className="text-sm text-muted-foreground">
                        System operating normally
                      </p>
                    </div>
                  </>
                );
              }
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}