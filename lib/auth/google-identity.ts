/**
 * Google Identity Services (accounts.google.com/gsi/client).
 *
 * Google puts the nonce we give it into the ID token. Supabase hashes the
 * nonce passed to signInWithIdToken (SHA-256, hex) and compares that to the
 * token. Send the hash to Google and the raw value to Supabase.
 * https://supabase.com/docs/guides/auth/social-login/auth-google
 */
export function googleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
}

export function isGoogleIdentityConfigured() {
  return googleClientId().length > 0;
}

export async function createGoogleNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  const nonce = btoa(raw);
  const encoded = new TextEncoder().encode(nonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { nonce, hashedNonce };
}
