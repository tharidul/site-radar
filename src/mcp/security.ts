import { validateScheme } from '../security/scheme-validator';
import { validatePublicUrl } from '../security/private-network.guard';

/**
 * Validates that a URL uses an allowed scheme (http/https) and does not target
 * a private, loopback, link-local (cloud metadata), or reserved IP address.
 * Throws a descriptive error if validation fails.
 */
export async function assertSafePublicUrl(url: string): Promise<void> {
  const schemeCheck = validateScheme(url);
  if (!schemeCheck.valid) {
    throw new Error(`Invalid URL scheme: ${schemeCheck.reason || 'Restricted scheme'}`);
  }

  const publicCheck = await validatePublicUrl(url);
  if (!publicCheck.valid) {
    throw new Error(`SSRF Blocked: Destination is a private, loopback, or reserved address (${publicCheck.reason || 'Restricted IP'})`);
  }
}
