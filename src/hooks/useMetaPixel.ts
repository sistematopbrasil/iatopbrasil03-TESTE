import { useEffect, useCallback } from 'react';

declare global {
  interface Window {
    fbq: any;
  }
}

const initializedPixels = new Set<string>();

interface UseMetaPixelOptions {
  pixelId?: string | null;
}

export const useMetaPixel = (options?: UseMetaPixelOptions) => {
  useEffect(() => {
    const pixelId = options?.pixelId;
    
    if (!pixelId) return;
    
    // Check if fbq script is already loaded
    if (!window.fbq) {
      // Load Meta Pixel script
      const script = document.createElement('script');
      script.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
      `;
      document.head.appendChild(script);
    }

    // Wait for fbq to be available then initialize
    const timer = setTimeout(() => {
      if (window.fbq) {
        console.log('Initializing Meta Pixel with ID:', pixelId);
        window.fbq('init', pixelId);
        window.fbq('track', 'PageView');
        
        // Add noscript fallback
        const existingNoscript = document.getElementById('fb-pixel-noscript');
        if (!existingNoscript) {
          const noscript = document.createElement('noscript');
          noscript.id = 'fb-pixel-noscript';
          const img = document.createElement('img');
          img.height = 1;
          img.width = 1;
          img.style.display = 'none';
          img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
          noscript.appendChild(img);
          document.body.insertBefore(noscript, document.body.firstChild);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [options?.pixelId]);

  const trackEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    if (window.fbq) {
      window.fbq('track', eventName, data);
      console.log('Meta Pixel event tracked:', eventName, data);
    }
  }, []);

  const trackCustomEvent = useCallback((eventName: string, data?: Record<string, any>) => {
    if (window.fbq) {
      window.fbq('trackCustom', eventName, data);
      console.log('Meta Pixel custom event tracked:', eventName, data);
    }
  }, []);

  return { trackEvent, trackCustomEvent };
};

