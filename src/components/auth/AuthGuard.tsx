'use client';

import { useUser } from '@clerk/nextjs';
import { SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Users, Clock, Zap } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  feature?: string;
}

export function AuthGuard({ children, fallback, feature }: AuthGuardProps) {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="animate-pulse bg-muted h-32 rounded" />;
  }

  if (!isSignedIn) {
    return fallback || <DefaultAuthFallback feature={feature} />;
  }

  return <>{children}</>;
}

interface DefaultAuthFallbackProps {
  feature?: string;
}

function DefaultAuthFallback({ feature }: DefaultAuthFallbackProps) {
  const features = [
    {
      icon: <Users className="w-5 h-5" />,
      title: "Channel Search",
      description: "Index entire YouTube channels and search across all videos"
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Chat History",
      description: "Save and revisit your conversations with videos"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Faster Processing",
      description: "Priority access to video processing and AI responses"
    }
  ];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">
          {feature ? `${feature} requires sign up` : 'Sign up to unlock more features'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="text-primary mt-0.5">{feature.icon}</div>
              <div>
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <SignInButton mode="modal">
          <Button className="w-full">
            Sign Up Free
          </Button>
        </SignInButton>
        
        <p className="text-xs text-center text-muted-foreground">
          No credit card required • Get started in seconds
        </p>
      </CardContent>
    </Card>
  );
}

export function AuthStatus() {
  const { user, isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="animate-pulse bg-muted h-4 w-20 rounded" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <span className="text-sm text-muted-foreground">Guest Mode</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      <span className="text-sm text-muted-foreground">
        Welcome, {user.firstName || user.emailAddresses[0]?.emailAddress}
      </span>
    </div>
  );
}