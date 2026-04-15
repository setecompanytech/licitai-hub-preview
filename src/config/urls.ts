/**
 * Centralized URL configuration for PRAEFECTUS platform.
 * Used for auth redirects, CORS, security guards, etc.
 */

export const APP_DOMAIN = 'praefectus.com.br';
export const APP_URL = `https://${APP_DOMAIN}`;

export const ALLOWED_HOSTS = [
  'praefectus.com.br',
  'app.praefectus.com.br',
  'lovable.app',
  'lovable.dev',
];

/**
 * Returns the correct origin for auth redirects.
 * In preview/dev environments, redirects to the production app subdomain.
 */
export function getRedirectOrigin(): string {
  const origin = window.location.origin;
  if (
    origin.includes('lovableproject.com') ||
    origin.includes('lovable.app') ||
    origin.includes('localhost')
  ) {
    return APP_URL;
  }
  return origin;
}
