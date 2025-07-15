import Link from 'next/link';
import Image from 'next/image';
import { Github, Twitter, Mail, FileText, Shield, Heart } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image
                src="/favicon.svg"
                alt="VidSift"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-bold text-lg">VidSift</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered YouTube video assistant. Chat with any video, get instant insights with precise timestamps.
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/yourusername/vidsift"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/vidsift"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="mailto:mofekayode@gmail.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div className="space-y-4">
            <h3 className="font-semibold">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/watch/BHO_glbVcIg" className="text-muted-foreground hover:text-foreground transition-colors">
                  Chat with Video
                </Link>
              </li>
              <li>
                <Link href="/dashboard?tab=channels" className="text-muted-foreground hover:text-foreground transition-colors">
                  My Channels
                </Link>
              </li>
              <li>
                <button
                  onClick={() => {
                    // This will open the roadmap modal
                    const event = new CustomEvent('open-roadmap-modal');
                    window.dispatchEvent(event);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  Roadmap
                </button>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="space-y-4">
            <h3 className="font-semibold">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="mailto:mofekayode@gmail.com?subject=VidSift%20Support"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <a 
                  href="mailto:mofekayode@gmail.com?subject=VidSift%20Bug%20Report"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Report a Bug
                </a>
              </li>
              <li>
                <a 
                  href="mailto:mofekayode@gmail.com?subject=VidSift%20Feature%20Request"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Request Feature
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-4">
            <h3 className="font-semibold">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="https://twitter.com/vidsift"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/yourusername/vidsift"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <span className="text-muted-foreground">
                  Beta Version
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} VidSift. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                Built with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> by the VidSift team
              </span>
              <span className="hidden md:inline">•</span>
              <span className="flex items-center gap-1">
                <Shield className="h-4 w-4" /> Your data is secure
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}