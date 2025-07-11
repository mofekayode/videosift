'use client';

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { RoadmapModal } from "@/components/roadmap/RoadmapModal";
import { useBanner } from "@/contexts/BannerContext";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export function DynamicHeader() {
  const { bannerVisible, showBanner } = useBanner();
  const pathname = usePathname();
  const isWatchPage = pathname.startsWith('/watch');
  
  return (
    <>
      {/* Logo - Top Left */}
      <div className={`fixed left-0 z-[9999] transition-all duration-300 ${
        bannerVisible && showBanner ? 'top-12' : 'top-2'
      } ${isWatchPage ? 'p-2 sm:p-4' : 'p-2 sm:p-4'}`}>
        <Link href="/" className={`flex items-center gap-2 hover:bg-background/90 transition-colors ${
          isWatchPage 
            ? 'bg-transparent hover:bg-background/50 rounded-md px-2 py-1 mt-2 sm:mt-4' 
            : 'bg-background/80 backdrop-blur-sm rounded-tr-lg rounded-br-lg px-3 py-2'
        }`}>
          <Image
            src="/favicon.svg"
            alt="MindSift"
            width={24}
            height={24}
            className={isWatchPage ? 'w-5 h-5' : 'w-6 h-6'}
          />
          <span className={`font-semibold transition-all ${
            isWatchPage 
              ? 'text-xs text-muted-foreground hidden' 
              : 'text-sm hidden sm:inline'
          }`}>MindSift</span>
        </Link>
      </div>

      {/* User Controls - Top Right */}
      <header className={`fixed right-0 p-2 sm:p-4 flex gap-2 items-center z-[9999] bg-background/80 backdrop-blur-sm rounded-bl-lg transition-all duration-300 ${
        bannerVisible && showBanner ? 'top-12' : 'top-2'
      }`}>
        <RoadmapModal />
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
    </>
  );
}