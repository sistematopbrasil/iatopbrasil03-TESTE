import { useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface TrackingData {
  // UTM Parameters
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  
  // Referrer e Landing
  referrer: string | null;
  landing_page: string;
  
  // Device
  device_type: string;
  browser: string;
  os: string;
  user_agent: string;
  
  // Session
  session_id: string;
  ip_address: string | null;
}

// Storage keys
const SESSION_KEY = 'tb_session_id';
const UTM_KEY = 'tb_utm_data';
const TRACKING_KEY = 'tb_tracking_data';

function getDeviceType(userAgent: string): string {
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function getBrowser(userAgent: string): string {
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) return 'Chrome';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) return 'Opera';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) return 'Internet Explorer';
  return 'Unknown';
}

function getOS(userAgent: string): string {
  if (userAgent.includes('Windows NT 10')) return 'Windows 10';
  if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1';
  if (userAgent.includes('Windows NT 6.2')) return 'Windows 8';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Linux') && !userAgent.includes('Android')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Unknown';
}

function getUTMParams(): Pick<TrackingData, 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'> {
  // First check URL params
  const urlParams = new URLSearchParams(window.location.search);
  
  const utmFromUrl = {
    utm_source: urlParams.get('utm_source'),
    utm_medium: urlParams.get('utm_medium'),
    utm_campaign: urlParams.get('utm_campaign'),
    utm_content: urlParams.get('utm_content'),
    utm_term: urlParams.get('utm_term'),
  };

  // If we have UTM params in URL, save them and return
  if (utmFromUrl.utm_source || utmFromUrl.utm_medium || utmFromUrl.utm_campaign) {
    localStorage.setItem(UTM_KEY, JSON.stringify(utmFromUrl));
    return utmFromUrl;
  }

  // Otherwise, try to get from storage (persistence)
  try {
    const stored = localStorage.getItem(UTM_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading UTM from storage:', e);
  }

  return utmFromUrl;
}

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  
  return sessionId;
}

async function fetchIPAddress(): Promise<string | null> {
  try {
    // Try multiple IP services for reliability
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.ip.sb/jsonip',
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, { 
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        if (response.ok) {
          const data = await response.json();
          return data.ip || null;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching IP:', error);
    return null;
  }
}

export function useTracking(options?: { fetchIP?: boolean }) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initTracking = useCallback(async () => {
    try {
      // Get UTM parameters
      const utmData = getUTMParams();

      // Get referrer and landing page
      const referrer = document.referrer || null;
      const landing_page = window.location.href;

      // Get device info
      const userAgent = navigator.userAgent;
      const device_type = getDeviceType(userAgent);
      const browser = getBrowser(userAgent);
      const os = getOS(userAgent);

      // Get or create session ID
      const session_id = getOrCreateSessionId();

      // Fetch IP address if enabled (default: true)
      const shouldFetchIP = options?.fetchIP !== false;
      let ip_address: string | null = null;
      
      if (shouldFetchIP) {
        // Check cached IP first
        const cachedIP = sessionStorage.getItem('tb_ip_address');
        if (cachedIP) {
          ip_address = cachedIP;
        } else {
          ip_address = await fetchIPAddress();
          if (ip_address) {
            sessionStorage.setItem('tb_ip_address', ip_address);
          }
        }
      }

      // Build tracking data object
      const tracking: TrackingData = {
        ...utmData,
        referrer,
        landing_page,
        device_type,
        browser,
        os,
        user_agent: userAgent,
        session_id,
        ip_address,
      };

      // Save to session storage for persistence
      sessionStorage.setItem(TRACKING_KEY, JSON.stringify(tracking));

      setTrackingData(tracking);
      return tracking;
    } catch (error) {
      console.error('Error initializing tracking:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options?.fetchIP]);

  useEffect(() => {
    // Check if we already have tracking data in session
    const cached = sessionStorage.getItem(TRACKING_KEY);
    if (cached) {
      try {
        setTrackingData(JSON.parse(cached));
        setIsLoading(false);
        return;
      } catch {
        // Ignore parse error, will reinitialize
      }
    }
    
    initTracking();
  }, [initTracking]);

  // Function to refresh tracking data
  const refreshTracking = useCallback(async () => {
    setIsLoading(true);
    return initTracking();
  }, [initTracking]);

  // Get session ID without full tracking data
  const getSessionId = useCallback(() => {
    return getOrCreateSessionId();
  }, []);

  return {
    trackingData,
    isLoading,
    refreshTracking,
    getSessionId,
  };
}
