/**
 * SSRF protection for the `goto` action.
 *
 * Set ALLOWED_DOMAINS in .env as a comma-separated list of hostnames (not full URLs).
 * If the var is absent the default list below is used.
 * Set to an empty string to disable the check entirely (dev only).
 *
 * Examples:
 *   ALLOWED_DOMAINS=google.com,api.acme.io
 *   ALLOWED_DOMAINS=           ← disables the check
 */

function parseAllowedDomains(): Set<string> | null {
  const raw = process.env.ALLOWED_DOMAINS;
  if (raw === "") return null; // explicitly disabled
  if (!raw) return new Set<string>(["example.com"]); // default
  return new Set(raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean));
}

export function isAllowedUrl(url: string): boolean {
  // Read env lazily so dotenv has time to populate process.env before first call
  const allowedDomains = parseAllowedDomains();
  if (allowedDomains === null) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Block non-http(s) schemes (file://, data://, javascript://, etc.)
  if (!["http:", "https:"].includes(parsed.protocol)) return false;

  // Block private/loopback ranges expressed as hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (isPrivateHostname(hostname)) return false;

  // Allowlist check — supports subdomain matching (e.g. "google.com" allows "www.google.com")
  return [...allowedDomains].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

/** Blocks well-known private/loopback hostnames. */
function isPrivateHostname(hostname: string): boolean {
  const blocked = [
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "169.254.169.254", // AWS metadata
    "metadata.google.internal",
  ];
  return blocked.includes(hostname);
}
