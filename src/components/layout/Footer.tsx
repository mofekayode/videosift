import Link from 'next/link';
import Image from 'next/image';
import { Github as GithubIcon, Twitter as TwitterIcon, Mail, Shield, Heart } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
       
        {/* Bottom Bar */}
        <div className="">
     
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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

            <div className='flex items-center gap-2'> Built with <Heart className="h-4 w-4 text-red-500 fill-red-500"/> by <a href="https://www.linkedin.com/in/mofekayode/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">Mofe</a></div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
              
                {/* <p className="text-sm text-muted-foreground">
              © {currentYear} VidSift. All rights reserved.
            </p> */}
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