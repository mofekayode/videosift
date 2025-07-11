'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BannerContextType {
  bannerVisible: boolean;
  setBannerVisible: (visible: boolean) => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
}

const BannerContext = createContext<BannerContextType | undefined>(undefined);

export function BannerProvider({ children }: { children: ReactNode }) {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  // Fade in banner after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <BannerContext.Provider value={{ 
      bannerVisible, 
      setBannerVisible, 
      showBanner, 
      setShowBanner 
    }}>
      {children}
    </BannerContext.Provider>
  );
}

export function useBanner() {
  const context = useContext(BannerContext);
  if (context === undefined) {
    throw new Error('useBanner must be used within a BannerProvider');
  }
  return context;
}