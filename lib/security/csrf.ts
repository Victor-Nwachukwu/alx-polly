import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const CSRF_TOKEN_NAME = 'csrf-token';
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get CSRF token from cookies
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value || null;
}

/**
 * Set CSRF token in cookies
 */
export async function setCSRFToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
  });
}

/**
 * Verify CSRF token
 */
export async function verifyCSRFToken(token: string): Promise<boolean> {
  const storedToken = await getCSRFToken();
  return storedToken === token;
}

/**
 * Generate and set CSRF token
 */
export async function generateAndSetCSRFToken(): Promise<string> {
  const token = generateCSRFToken();
  await setCSRFToken(token);
  return token;
}

/**
 * Middleware to check CSRF token in forms
 */
export async function validateCSRFToken(formData: FormData): Promise<boolean> {
  const token = formData.get('csrf-token') as string;
  if (!token) return false;
  
  return await verifyCSRFToken(token);
}
