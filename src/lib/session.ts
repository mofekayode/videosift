import { v4 as uuidv4 } from 'uuid';

// Generate a unique anonymous session ID
export function generateAnonId(): string {
  return `anon_${uuidv4()}`;
}

// Storage key for anonymous ID
const ANON_ID_KEY = 'mindsift_anon_id';

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