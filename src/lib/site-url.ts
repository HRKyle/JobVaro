/**
 * Canonical base URL for the app — used in emails (verify / password-reset
 * links) and Stripe checkout redirects.
 *
 * Defaults to the canonical/live domain. Override with the SITE_URL env var
 * (e.g. https://jobvaro.ctonew.app during pre-launch while the custom domain
 * is unreachable) so transactional links always point at a working host.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "https://www.jobvaro.com").replace(/\/+$/, "");
}