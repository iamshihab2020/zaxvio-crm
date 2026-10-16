import { describe, expect, it } from "vitest";

import {
  type ResolveAll,
  validateOutboundUrl,
} from "../services/workflow/http/url-validator.js";

/**
 * The SSRF guard on `http.request` and `webhook.send`.
 *
 * Written after ONB-05: `new URL("http://[::ffff:169.254.169.254]/")` hands
 * back the hostname `[::ffff:a9fe:a9fe]`, and the validator only recognised the
 * dotted spelling — so the one form a literal URL can actually produce reached
 * cloud metadata. Every case below is a different spelling of an address the
 * guard must refuse, because that is the axis it was beaten on.
 */

/** A resolver that answers every name with the given addresses. */
function resolvesTo(...addresses: string[]): ResolveAll {
  return async () => addresses.map((address) => ({ address }));
}

async function reason(url: string, dns?: ResolveAll) {
  const result = await validateOutboundUrl(url, dns);
  return result.ok ? "ok" : result.reason;
}

describe("validateOutboundUrl — literal addresses", () => {
  it.each([
    ["http://169.254.169.254/latest/meta-data/", "link_local"],
    ["http://[::ffff:169.254.169.254]/", "link_local"],
    ["http://[::ffff:a9fe:a9fe]/", "link_local"],
    ["http://[0:0:0:0:0:ffff:a9fe:a9fe]/", "link_local"],
    ["http://[::ffff:0:a9fe:a9fe]/", "link_local"],
    ["http://[::a9fe:a9fe]/", "link_local"],
    ["http://[64:ff9b::a9fe:a9fe]/", "link_local"],
    ["http://[2002:a9fe:a9fe::1]/", "link_local"],
    ["http://[::ffff:127.0.0.1]/", "loopback"],
    ["http://[::ffff:7f00:1]/", "loopback"],
    ["http://[::ffff:10.0.0.1]/", "private_address"],
    ["http://[::ffff:c0a8:101]/", "private_address"],
    ["http://[::1]/", "loopback"],
    ["http://[0:0:0:0:0:0:0:1]/", "loopback"],
    ["http://[::]/", "unspecified"],
    ["http://[fd00:ec2::254]/", "private_address"],
    ["http://[fe80::1]/", "link_local"],
    ["http://[fec0::1]/", "private_address"],
    ["http://[ff02::1]/", "private_address"],
    ["http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/", "private_address"],
    ["http://[64:ff9b:1::1]/", "private_address"],
    ["http://127.0.0.1/", "loopback"],
    ["http://0x7f.1/", "loopback"],
    ["http://2130706433/", "loopback"],
    ["http://10.1.2.3/", "private_address"],
  ])("%s → %s", async (url, expected) => {
    expect(await reason(url)).toBe(expected);
  });

  it.each([
    "http://8.8.8.8/",
    "http://[2606:4700:4700::1111]/",
    "http://[::ffff:8.8.8.8]/",
    "http://[64:ff9b::808:808]/",
  ])("allows the public address %s", async (url) => {
    expect(await reason(url)).toBe("ok");
  });
});

describe("validateOutboundUrl — resolved addresses", () => {
  it("refuses a hostname that resolves to a hex-mapped metadata address", async () => {
    expect(await reason("https://example.test/", resolvesTo("::ffff:a9fe:a9fe"))).toBe(
      "link_local",
    );
  });

  it("refuses a hostname with one public and one private answer", async () => {
    expect(
      await reason("https://example.test/", resolvesTo("93.184.216.34", "::ffff:10.0.0.5")),
    ).toBe("private_address");
  });

  it("returns the resolved addresses so the caller can pin them", async () => {
    const result = await validateOutboundUrl(
      "https://example.test/",
      resolvesTo("93.184.216.34"),
    );
    expect(result.ok && result.addresses).toEqual(["93.184.216.34"]);
  });
});
