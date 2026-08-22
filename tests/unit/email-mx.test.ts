import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  The lookup that decides whether a domain has anywhere to put mail.

  Its bias is the whole point and is what these tests hold still. A definite
  "no such name" is the only answer that turns somebody away. Every other
  outcome, including the ones that look like failure, has to let the sign-in
  through: a slow resolver is not evidence about anybody's address, and an
  outage that quietly locks every new player out would be a far worse fault
  than the bounce this exists to prevent.
*/

const resolveMx = vi.fn();
const resolve4 = vi.fn();
const resolve6 = vi.fn();

vi.mock("node:dns/promises", () => ({
  default: { resolveMx, resolve4, resolve6 },
  resolveMx,
  resolve4,
  resolve6,
}));

/** What the resolver throws when it is certain there is nothing there. */
function missing(code: "ENOTFOUND" | "NXDOMAIN" | "ENODATA") {
  return Object.assign(new Error(code), { code });
}

async function load() {
  const lookup = await import("@/lib/auth/email-mx");
  lookup.forgetDomainAnswers();
  return lookup;
}

beforeEach(() => {
  resolveMx.mockReset();
  resolve4.mockReset();
  resolve6.mockReset();
});

describe("a domain that can receive mail", () => {
  it("accepts one with a mail exchanger", async () => {
    resolveMx.mockResolvedValue([{ exchange: "gmail-smtp-in.l.google.com", priority: 5 }]);
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("gmail.com")).toBe(true);
  });

  it("accepts one with only an address record", async () => {
    // No MX is not no mail: the host is its own exchanger, by RFC 5321, and
    // plenty of small domains are set up exactly this way.
    resolveMx.mockRejectedValue(missing("ENODATA"));
    resolve4.mockResolvedValue(["203.0.113.10"]);
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("small.example-company.com")).toBe(true);
  });

  it("accepts one reachable over IPv6 alone", async () => {
    resolveMx.mockRejectedValue(missing("ENODATA"));
    resolve4.mockRejectedValue(missing("ENODATA"));
    resolve6.mockResolvedValue(["2001:db8::1"]);
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("v6.example-company.com")).toBe(true);
  });
});

describe("a domain that cannot", () => {
  it("turns away a name that does not exist", async () => {
    resolveMx.mockRejectedValue(missing("ENOTFOUND"));
    resolve4.mockRejectedValue(missing("ENOTFOUND"));
    resolve6.mockRejectedValue(missing("ENOTFOUND"));
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("gmial-not-a-domain.com")).toBe(false);
  });

  it("turns away a domain that publishes that it takes no mail", async () => {
    // A single exchanger of "." is the published way of saying so.
    resolveMx.mockResolvedValue([{ exchange: ".", priority: 0 }]);
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("no-mail.example-company.com")).toBe(false);
  });
});

describe("when the domain system cannot say", () => {
  it("lets a sign-in through on a server failure", async () => {
    resolveMx.mockRejectedValue(Object.assign(new Error("SERVFAIL"), { code: "SERVFAIL" }));
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("gmail.com")).toBe(true);
  });

  it("lets a sign-in through when the lookup times out", async () => {
    resolveMx.mockRejectedValue(Object.assign(new Error("timeout"), { code: "ETIMEOUT" }));
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("gmail.com")).toBe(true);
  });

  it("lets a sign-in through when there is no resolver at all", async () => {
    resolveMx.mockRejectedValue(new Error("dns is not available here"));
    const { domainAcceptsMail } = await load();
    expect(await domainAcceptsMail("gmail.com")).toBe(true);
  });
});

describe("not asking the same question all day", () => {
  it("remembers a yes", async () => {
    resolveMx.mockResolvedValue([{ exchange: "in.example.net", priority: 5 }]);
    const { domainAcceptsMail } = await load();

    expect(await domainAcceptsMail("gmail.com")).toBe(true);
    expect(await domainAcceptsMail("gmail.com")).toBe(true);
    expect(resolveMx).toHaveBeenCalledTimes(1);
  });

  it("remembers a no, so a busy form does not re-ask", async () => {
    resolveMx.mockRejectedValue(missing("ENOTFOUND"));
    resolve4.mockRejectedValue(missing("ENOTFOUND"));
    resolve6.mockRejectedValue(missing("ENOTFOUND"));
    const { domainAcceptsMail } = await load();

    expect(await domainAcceptsMail("nowhere.example-company.com")).toBe(false);
    expect(await domainAcceptsMail("nowhere.example-company.com")).toBe(false);
    expect(resolveMx).toHaveBeenCalledTimes(1);
  });
});
