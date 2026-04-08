/**
 * SSRF protection for the `goto` action.
 *
 * Set ALLOWED_DOMAINS in .env as a comma-separated list of hostnames.
 * If the list is empty the default below is used.
 * An empty string ("") disables the check entirely (development only).
 *
 * Examples:
 *   ALLOWED_DOMAINS=example.com,api.acme.io
 *   ALLOWED_DOMAINS=           ← blocks ALL external navigation
 */

const raw = process.env.ALLOWED_DOMAINS;

// Parse once at startup
const allowedDomains: Set<string> | null = (() => {
  if (raw === "") return null; // empty string → disabled
  if (!raw) {
    // Default allowlist when env var is absent
    return new Set<string>(["example.com"]);
  }
  return new Set(raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean));
})();

export function isAllowedUrl(url: string): boolean {
  if (allowedDomains === null) return true; // check disabled

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // unparseable URL is always blocked
  }

  // Block non-http(s) schemes (file://, data://, javascript://, etc.)
  if (!["http:", "https:"].includes(parsed.protocol)) return false;

  // Block private/loopback ranges expressed as hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (isPrivateHostname(hostname)) return false;

  // Check against the allowlist (supports subdomain matching)
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
