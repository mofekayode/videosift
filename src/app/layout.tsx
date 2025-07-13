import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { BannerProvider } from "@/contexts/BannerContext";
import { DynamicHeader } from "@/components/layout/DynamicHeader";
import { TopBanner } from "@/components/layout/TopBanner";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "sonner";
import { checkRequiredEnvVars } from "@/lib/check-env";
import "./globals.css";

// Check environment variables on client
if (typeof window !== 'undefined') {
  checkRequiredEnvVars();
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MindSift - Chat with YouTube Videos",
  description: "Chat with any YouTube video using AI. Paste a link and start asking questions.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider defaultTheme="dark">
            <PostHogProvider>
              <BannerProvider>
                <ErrorBoundary>
                  <div className="min-h-screen flex flex-col">
                    <TopBanner />
                    <DynamicHeader />
                    <main className="flex-1">
                      {children}
                    </main>
                  </div>
                  <Toaster 
                    position="top-right"
                    toastOptions={{
                      style: {
                        background: '#1a1a1a',
                        color: '#fff',
                        border: '1px solid #333',
                      },
                    }}
                  />
                </ErrorBoundary>
              </BannerProvider>
            </PostHogProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
