import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { BannerProvider } from "@/contexts/BannerContext";
import { DynamicHeader } from "@/components/layout/DynamicHeader";
import "./globals.css";

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
            <BannerProvider>
              <DynamicHeader />
              {children}
            </BannerProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
