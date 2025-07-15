import { v4 as uuidv4 } from 'uuid';
import { getDeviceId } from './device-fingerprint';

// Generate a unique anonymous session ID
export function generateAnonId(): string {
  return `anon_${uuidv4()}`;
}

// Generate device-specific anonymous ID
export async function generateDeviceAnonId(): Promise<string> {
  try {
    const deviceId = await getDeviceId();
    return `anon_device_${deviceId}`;
  } catch (error) {
    console.error('Failed to generate device-based anon ID:', error);
    return generateAnonId(); // Fallback to UUID
  }
}

// Storage key for anonymous ID
const ANON_ID_KEY = 'vidsift_anon_id';

// Get or create anonymous ID from localStorage
export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') {
    // Server-side, generate temporary ID
    return generateAnonId();
  }

  let anonId = localStorage.getItem(ANON_ID_KEY);
  if (!anonId) {
    anonId = generateAnonId();
    localStorage.setItem(ANON_ID_KEY, anonId);
  }
  return anonId;
}

// Get or create device-specific anonymous ID
export async function getOrCreateDeviceAnonId(): Promise<string> {
  if (typeof window === 'undefined') {
    return generateAnonId();
  }

  // First check if we have a device-based ID stored
  let anonId = localStorage.getItem(ANON_ID_KEY);
  
  // If it's an old UUID-based ID, replace it with device-based
  if (anonId && !anonId.includes('device_')) {
    anonId = await generateDeviceAnonId();
    localStorage.setItem(ANON_ID_KEY, anonId);
    // Also set in cookie for redundancy
    setCookie(ANON_ID_KEY, anonId, 365);
  } else if (!anonId) {
    anonId = await generateDeviceAnonId();
    localStorage.setItem(ANON_ID_KEY, anonId);
    setCookie(ANON_ID_KEY, anonId, 365);
  }
  
  return anonId;
}

// Cookie helper
function setCookie(name: string, value: string, days: number) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
}

// Clear anonymous ID (used when user signs in)
export function clearAnonId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ANON_ID_KEY);
  }
}

// Get current anonymous ID (without creating new one)
export function getCurrentAnonId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(ANON_ID_KEY);
}

// Alias functions for backward compatibility
export const getStoredAnonId = getCurrentAnonId;
export function setStoredAnonId(anonId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ANON_ID_KEY, anonId);
  }
}