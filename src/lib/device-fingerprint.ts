/**
 * Generate a device fingerprint based on browser characteristics
 * This helps identify the same device even if cookies/localStorage are cleared
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];
  
  try {
    // 1. User Agent
    components.push(navigator.userAgent);
    
    // 2. Screen Resolution
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    
    // 3. Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // 4. Language
    components.push(navigator.language);
    
    // 5. Platform
    components.push(navigator.platform);
    
    // 6. Hardware Concurrency (CPU cores)
    components.push(String(navigator.hardwareConcurrency || 0));
    
    // 7. Device Memory (if available)
    if ('deviceMemory' in navigator) {
      components.push(String((navigator as any).deviceMemory || 0));
    }
    
    // 8. WebGL Renderer (GPU info)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
      }
    } catch (e) {
      // WebGL not available
    }
    
    // 9. Touch Support
    components.push(String('ontouchstart' in window));
    
    // 10. Plugin info (limited in modern browsers)
    if (navigator.plugins) {
      const plugins = Array.from(navigator.plugins)
        .map(p => p.name)
        .sort()
        .join(',');
      components.push(plugins);
    }
    
    // Create a hash of all components
    const fingerprint = await hashString(components.join('|'));
    return fingerprint;
  } catch (error) {
    console.error('Failed to generate device fingerprint:', error);
    // Fallback to random ID if fingerprinting fails
    return 'fallback_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }
}

/**
 * Hash a string using Web Crypto API
 */
async function hashString(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // Use first 16 chars for brevity
}

/**
 * Get or create a persistent device ID
 * Combines device fingerprint with stored IDs for redundancy
 */
export async function getDeviceId(): Promise<string> {
  // Try to get existing device ID from multiple sources
  const stored = {
    localStorage: localStorage.getItem('mindsift_device_id'),
    sessionStorage: sessionStorage.getItem('mindsift_device_id'),
    cookie: getCookie('mindsift_device_id')
  };
  
  // If we have a consistent ID across storage, use it
  if (stored.localStorage && stored.localStorage === stored.cookie) {
    return stored.localStorage;
  }
  
  // Generate device fingerprint
  const fingerprint = await generateDeviceFingerprint();
  const deviceId = `device_${fingerprint}_${Date.now()}`;
  
  // Store in multiple places
  localStorage.setItem('mindsift_device_id', deviceId);
  sessionStorage.setItem('mindsift_device_id', deviceId);
  setCookie('mindsift_device_id', deviceId, 365); // 1 year
  
  return deviceId;
}

/**
 * Cookie helper functions
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

function setCookie(name: string, value: string, days: number) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
}