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

/**
 * An IPv6 address as its eight 16-bit groups, or null if it is not one.
 *
 * Parsed for the same reason `isBlockedV4` parses octets: an IPv6 address has
 * many spellings and a pattern matches exactly one of them. The one that
 * mattered (ONB-05) is that **`new URL()` rewrites an embedded dotted quad into
 * hex** — `http://[::ffff:169.254.169.254]/` comes out of the parser with the
 * hostname `[::ffff:a9fe:a9fe]`, so a regex looking for `::ffff:d.d.d.d` never
 * saw the one form a literal URL can actually produce, and the metadata
 * endpoint was reachable. Zero-padding (`0:0:0:0:0:ffff:…`) and a trailing
 * dotted quad are both normalised away here.
 */
function parseV6(address: string): number[] | null {
  let value = address.toLowerCase().split("%")[0];

  // A trailing dotted quad is the last two groups written in decimal.
  const dotted = value.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const octets = dotted.slice(2).map(Number);
    if (octets.some((n) => n > 255)) return null;
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${dotted[1]}${hi}:${lo}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const groups = (part: string) =>
    part === ""
      ? []
      : part.split(":").map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));

  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  if ([...head, ...tail].some(Number.isNaN)) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const gap = 8 - head.length - tail.length;
  if (gap < 1) return null;
  return [...head, ...new Array<number>(gap).fill(0), ...tail];
}

/** Two 16-bit groups as the dotted quad they carry. */
function embeddedV4(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

function isBlockedV6(address: string): UrlRejection | null {
  const g = parseV6(address);
  // `isIP` already said this is IPv6. Failing to parse it means this function
  // and Node disagree about the address — refuse rather than guess.
  if (!g) return "private_address";

  const zeroThrough = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (zeroThrough(8)) return "unspecified"; // ::
  if (zeroThrough(7) && g[7] === 1) return "loopback"; // ::1

  // Every form that carries an IPv4 address inside it is judged by THAT
  // address. `::ffff:169.254.169.254` is the metadata endpoint wearing a hat,
  // and so is each of these.
  // ::ffff:0:0/96 — IPv4-mapped. The one the kernel will actually route.
  if (zeroThrough(5) && g[5] === 0xffff) return isBlockedV4(embeddedV4(g[6], g[7]));
  // ::ffff:0:0:0/96 — IPv4-translated (SIIT).
  if (zeroThrough(4) && g[4] === 0xffff && g[5] === 0) {
    return isBlockedV4(embeddedV4(g[6], g[7]));
  }
  // ::/96 — IPv4-compatible. Deprecated, but deprecated is not unreachable.
  if (zeroThrough(6)) return isBlockedV4(embeddedV4(g[6], g[7]));
  // 64:ff9b::/96 — NAT64. On a network with a NAT64 gateway this IS the IPv4
  // address, so a private one behind it is private.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedV4(embeddedV4(g[6], g[7]));
  }
  // 64:ff9b:1::/48 — local-use NAT64, by definition not the internet.
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return "private_address";
  // 2002::/16 — 6to4. The IPv4 address is groups 1–2.
  if (g[0] === 0x2002) return isBlockedV4(embeddedV4(g[1], g[2]));
  // 2001::/32 — Teredo. Its client address is obfuscated, so it cannot be
  // judged; and no webhook receiver anybody means to call lives on a Teredo
  // tunnel.
  if (g[0] === 0x2001 && g[1] === 0) return "private_address";

  // fc00::/7 — unique local. AWS's IPv6 metadata endpoint, fd00:ec2::254, is here.
  if ((g[0] & 0xfe00) === 0xfc00) return "private_address";
  // fe80::/10 — link-local.
  if ((g[0] & 0xffc0) === 0xfe80) return "link_local";
  // fec0::/10 — site-local. Deprecated, still private.
  if ((g[0] & 0xffc0) === 0xfec0) return "private_address";
  // ff00::/8 — multicast.
  if ((g[0] & 0xff00) === 0xff00) return "private_address";

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
 * guard nobody will ever write a test for. It is typed as the one overload this
 * module calls rather than `typeof lookup`, so a test can pass a plain function
 * instead of casting one into the shape of all five.
 */
export type ResolveAll = (
  hostname: string,
  options: { all: true },
) => Promise<{ address: string }[]>;

export async function validateOutboundUrl(
  raw: string,
  dnsLookup: ResolveAll = lookup,
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
