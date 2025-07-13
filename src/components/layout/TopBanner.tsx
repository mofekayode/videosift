'use client';

import { useBanner } from '@/contexts/BannerContext';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TopBanner() {
  const { bannerVisible, setBannerVisible, showBanner } = useBanner();

  if (!bannerVisible || !showBanner) {
    return null;
  }

  return (
    <div className="w-full bg-primary/10 border-b px-4 py-2">
      <div className="relative max-w-6xl mx-auto">
        <div className="flex items-center justify-center">
          <p className="text-sm text-muted-foreground text-center">
            <span className="font-semibold">Welcome to MindSift!</span> This is a beta release. 
            You can report bugs or request features{' '}
            <a 
              href="mailto:mofekayode@gmail.com?subject=MindSift%20Feedback" 
              className="underline hover:text-foreground transition-colors"
            >
              here
            </a>.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBannerVisible(false)}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}