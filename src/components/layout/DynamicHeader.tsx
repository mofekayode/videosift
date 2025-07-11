'use client';

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useBanner } from "@/contexts/BannerContext";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export function DynamicHeader() {
  const { bannerVisible, showBanner } = useBanner();
  
  return (
    <header className={`fixed right-0 p-2 sm:p-4 flex gap-2 items-center z-[9999] bg-background/80 backdrop-blur-sm rounded-bl-lg transition-all duration-300 ${
      bannerVisible && showBanner ? 'top-12' : 'top-2'
    }`}>
      <ThemeToggle />
      <SignedOut>
        <SignInButton mode="modal">
          <Button size="sm" className="text-xs sm:text-sm">
            Sign In
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-8 h-8 sm:w-9 sm:h-9"
            }
          }}
        />
      </SignedIn>
    </header>
  );
}