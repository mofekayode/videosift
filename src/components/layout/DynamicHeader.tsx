'use client';

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { RoadmapModal } from "@/components/roadmap/RoadmapModal";
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
  const pathname = usePathname();
  const isWatchPage = pathname.startsWith('/watch');
  const isChannelPage = pathname.startsWith('/chat/channel');
  
  // Don't show header on pages that have their own header
  if (isWatchPage || isChannelPage) {
    return null;
  }
  
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo - Left side */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image
            src="/favicon.svg"
            alt="VidSift"
            width={24}
            height={24}
            className="w-6 h-6"
          />
          <span className="font-semibold text-sm hidden sm:inline">VidSift</span>
        </Link>

        {/* User Controls - Right side */}
        <div className="flex gap-2 items-center">
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
        </div>
      </div>
    </header>
  );
}