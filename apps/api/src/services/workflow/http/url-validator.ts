/**
 * The guard on outbound HTTP. P10.
 *
 * [[wf-10-security|§10.5]] calls this *"the single highest-severity risk in the
 * feature"*, and the reason is worth restating rather than assuming: an
 * unguarded HTTP node lets any tenant read cloud metadata credentials, reach
 * anything in the private network the API sits in, and use the API as an open
 * proxy. All three are one `http.request` node and a URL away.
 *
 * ## The DNS-rebinding hole, which is the subtle one
 *
 * Validating a hostname and then handing the *hostname* to a fetch is not a
 * guard. An attacker controls their own DNS: they answer the validator's lookup
 * with a public address and the connection's lookup, milliseconds later, with
 * `169.254.169.254`. Both answers are legitimately theirs to give.
 *
 * So this module **resolves the hostname, validates the resolved addresses, and
 * returns them**. The caller connects to the address, not to the name. That is
 * the difference between a check and a decoration, and it is the item on §10.5's
 * list most likely to be skipped by someone reading only the first two lines.
 *
 * ## Every redirect is a new decision
 *
 * A 302 to `http://169.254.169.254/` defeats a validator that only ever saw the
 * first URL. Each hop is re-validated from scratch, and the count is capped —
 * an unbounded redirect chain is its own denial of service.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** §10.5: `http`/`https` only. No `file:`, `gopher:`, `ftp:`, `data:`. */
const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

export type UrlRejection =
  | "bad_url"
  | "bad_scheme"
  | "credentials_in_url"
  | "no_such_host"
  | "private_address"
  | "link_local"
  | "loopback"
  | "unspecified";

export type UrlCheck =
  | {
      ok: true;
      url: URL;
      /** Connect to **these**, never re-resolve the hostname. */
      addresses: string[];
    }
  | { ok: false; reason: UrlRejection; message: string };

function reject(reason: UrlRejection, message: string): UrlCheck {
  return { ok: false, reason, message };
}

/**
 * Is this IPv4 address one we refuse?
 *
 * Parsed into octets rather than matched with a regex. `10.0.0.1` and
 * `010.0.0.1` and `0xA.0.0.1` are the same address to a resolver and different
 * strings to a pattern, and a guard that can be defeated by a leading zero is
 * not a guard. Node's resolver hands back canonical dotted-quad, so this is
 * belt-and-braces — but the belt is what the next person will trust.
 */
function isBlockedV4(address: string): UrlRejection | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return "private_address";
  }
  const [a, b] = parts;

  if (a === 0) return "unspecified"; // 0.0.0.0/8
  if (a === 127) return "loopback"; // 127.0.0.0/8
  if (a === 10) return "private_address"; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return "private_address"; // 172.16.0.0/12
  if (a === 192 && b === 168) return "private_address"; // 192.168.0.0/16
  // The one that matters most: cloud instance metadata lives at
  // 169.254.169.254 on AWS, GCP and Azure alike.
  if (a === 169 && b === 254) return "link_local"; // 169.254.0.0/16
  // Carrier-grade NAT and the benchmarking range are not the internet either.
  if (a === 100 && b >= 64 && b <= 127) return "private_address";
  if (a === 198 && (b === 18 || b === 19)) return "private_address";
  // Multicast and reserved.
  if (a >= 224) return "private_address";

  return null;
}

function isBlockedV6(address: string): UrlRejection | null {
  const value = address.toLowerCase().split("%")[0];

  if (value === "::" ) return "unspecified";
  if (value === "::1") return "loopback";
  // fc00::/7 — unique local.
  if (/^f[cd]/.test(value)) return "private_address";
  // fe80::/10 — link-local, and the IPv6 metadata endpoint.
  if (/^fe[89ab]/.test(value)) return "link_local";
  // ff00::/8 — multicast.
  if (/^ff/.test(value)) return "private_address";

  // IPv4-mapped (`::ffff:169.254.169.254`) is the same address wearing a hat.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);

  return null;
}

function blockedReason(address: string): UrlRejection | null {
  const family = isIP(address);
  if (family === 4) return isBlockedV4(address);
  if (family === 6) return isBlockedV6(address);
  return "private_address";
}

const MESSAGES: Record<UrlRejection, string> = {
  bad_url: "That is not a valid web address.",
  bad_scheme: "Only http:// and https:// addresses can be called.",
  credentials_in_url:
    "Put the username and password in a header rather than in the address.",
  no_such_host: "That address could not be found.",
  private_address:
    "That address is on a private network, so it cannot be reached from here.",
  link_local:
    "That address is a server's own internal address and cannot be called.",
  loopback: "That address points back at this server and cannot be called.",
  unspecified: "That is not an address that can be reached.",
};

/**
 * Validate one URL and resolve it to addresses that are safe to connect to.
 *
 * `dnsLookup` is injectable for tests only. A guard whose behaviour cannot be
 * exercised for `169.254.169.254` without an attacker-controlled domain is a
 * guard nobody will ever write a test for.
 */
export async function validateOutboundUrl(
  raw: string,
  dnsLookup: typeof lookup = lookup,
): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return reject("bad_url", MESSAGES.bad_url);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return reject("bad_scheme", MESSAGES.bad_scheme);
  }

  // `http://user:pass@host` — refused rather than stripped. Credentials in a URL
  // end up in logs, in redirects, and in the `Referer` of anything that follows.
  if (url.username || url.password) {
    return reject("credentials_in_url", MESSAGES.credentials_in_url);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  // A literal address skips DNS entirely — and must still be checked, because
  // `http://127.0.0.1/` needs no resolver to be dangerous.
  if (isIP(host)) {
    const reason = blockedReason(host);
    if (reason) return reject(reason, MESSAGES[reason]);
    return { ok: true, url, addresses: [host] };
  }

  let resolved: { address: string }[];
  try {
    // `all: true`, so a hostname answering with one public and one private
    // address is refused rather than being 50% safe depending on which the
    // connection happens to pick.
    resolved = await dnsLookup(host, { all: true });
  } catch {
    return reject("no_such_host", MESSAGES.no_such_host);
  }

  if (resolved.length === 0) {
    return reject("no_such_host", MESSAGES.no_such_host);
  }

  for (const entry of resolved) {
    const reason = blockedReason(entry.address);
    if (reason) return reject(reason, MESSAGES[reason]);
  }

  return { ok: true, url, addresses: resolved.map((entry) => entry.address) };
}

/** §10.5: cap the chain at 3. An unbounded one is its own denial of service. */
export const MAX_REDIRECTS = 3;

/** §10.5: 5s to connect, 10s to read. */
export const CONNECT_TIMEOUT_MS = 5_000;
export const READ_TIMEOUT_MS = 10_000;

/** §10.5: 1 MB. Beyond this the response is dropped, not truncated. */
export const MAX_RESPONSE_BYTES = 1024 * 1024;
