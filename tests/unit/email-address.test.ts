import { describe, expect, it } from "vitest";
import {
  isSendable,
  normalizeEmail,
  readEmail,
  suggestDomain,
} from "@/lib/auth/email-address";

/*
  The address check that stands in front of every sign-in link.

  Two failures are being guarded against and they pull in opposite directions.
  Sending to an address that cannot receive costs the whole project: enough
  bounces and the provider throttles sending, which locks out everybody who
  typed their address correctly. Refusing an address that can receive costs one
  person their account, permanently, with no way for them to argue.

  So the tests below are as interested in what is allowed through as in what is
  turned away.
*/

describe("tidying an address before judging it", () => {
  it("drops the things a paste brings with it", () => {
    expect(normalizeEmail("  Player@Gmail.com  ")).toBe("player@gmail.com");
    expect(normalizeEmail("mailto:player@gmail.com")).toBe("player@gmail.com");
    expect(normalizeEmail("<player@gmail.com>")).toBe("player@gmail.com");
    expect(normalizeEmail('"player@gmail.com"')).toBe("player@gmail.com");
  });

  /*
    Both at once, which is exactly what a mail client puts on the clipboard.
    Stripping the scheme first left the brackets holding it in place, so the
    address came back as `mailto:player@gmail.com` and failed the syntax
    check a line later.
  */
  it("drops a bracketed mailto, which is what a mail client copies", () => {
    expect(normalizeEmail("<mailto:player@gmail.com>")).toBe("player@gmail.com");
    expect(normalizeEmail("  <MAILTO:Player@Gmail.com>  ")).toBe("player@gmail.com");
  });

  it("removes the invisible characters a copy from a web page carries", () => {
    expect(normalizeEmail("player@gmail.com​")).toBe("player@gmail.com");
    expect(normalizeEmail("﻿player@gmail.com")).toBe("player@gmail.com");
  });

  it("drops the trailing dot of a fully qualified name", () => {
    // Legal, and refused by enough mail systems to be worth not arguing about.
    expect(normalizeEmail("player@gmail.com.")).toBe("player@gmail.com");
  });
});

describe("addresses that are allowed through", () => {
  it("passes ordinary ones untouched", () => {
    for (const address of [
      "player@gmail.com",
      "first.last@outlook.com",
      "player+arena@hot.ee",
      "p@x.co",
      "a_b-c@sub.department.example-company.com",
    ]) {
      expect(readEmail(address)).toEqual({ kind: "ok", email: address });
    }
  });

  it("does not question a small domain nobody has heard of", () => {
    // The whole product depends on people at their own domains getting in.
    expect(readEmail("martin@upthink.ee").kind).toBe("ok");
    expect(readEmail("player@zone.ee").kind).toBe("ok");
  });

  it("allows a new top level domain it has never seen", () => {
    expect(readEmail("player@arena.games").kind).toBe("ok");
    expect(readEmail("player@studio.photography").kind).toBe("ok");
  });
});

describe("addresses that cannot receive mail", () => {
  const refusal = (address: string) => {
    const verdict = readEmail(address);
    expect(verdict.kind).toBe("unreachable");
    return verdict.kind === "unreachable" ? verdict.message : "";
  };

  it("refuses the reserved names, which are a guaranteed bounce", () => {
    // RFC 2606 exists so that these never resolve. They land in real sign-in
    // fields constantly, because a placeholder teaches people to type them.
    expect(refusal("player@example.com")).toContain("reserved");
    expect(refusal("player@example.org")).toContain("reserved");
    expect(refusal("player@arena.test")).toContain("reserved");
    expect(refusal("player@localhost")).toBeTruthy();
    expect(refusal("player@box.local")).toContain("reserved");
    expect(refusal("player@thing.invalid")).toContain("reserved");
  });

  it("refuses a mailbox that only ever sends", () => {
    expect(refusal("noreply@gmail.com")).toContain("only sends");
    expect(refusal("do-not-reply@arena.games")).toContain("only sends");
  });

  it("refuses what is not an address at all", () => {
    expect(refusal("")).toBeTruthy();
    expect(refusal("player")).toBeTruthy();
    expect(refusal("player@")).toBeTruthy();
    expect(refusal("@gmail.com")).toBeTruthy();
    expect(refusal("player@@gmail.com")).toBeTruthy();
    expect(refusal("player @gmail.com")).toBeTruthy();
    expect(refusal("player@gmail")).toBeTruthy();
    expect(refusal("player@.com")).toBeTruthy();
    expect(refusal("player@gmail..com")).toBeTruthy();
    expect(refusal(".player@gmail.com")).toBeTruthy();
    expect(refusal("player.@gmail.com")).toBeTruthy();
    expect(refusal("player@-gmail.com")).toBeTruthy();
    expect(refusal("player@gmail.c0m")).toBeTruthy();
    expect(refusal(`${"a".repeat(65)}@gmail.com`)).toBeTruthy();
  });

  it("says which part is wrong, because a sign-in form is not a puzzle", () => {
    expect(refusal("player@gmail")).toContain("domain");
    expect(refusal("player gmail.com")).toBeTruthy();
  });
});

describe("the domains worth asking about", () => {
  it("catches the classic slips", () => {
    expect(suggestDomain("gmial.com")).toBe("gmail.com");
    expect(suggestDomain("gmai.com")).toBe("gmail.com");
    expect(suggestDomain("gmail.con")).toBe("gmail.com");
    expect(suggestDomain("gmail.co")).toBe("gmail.com");
    expect(suggestDomain("gnail.com")).toBe("gmail.com");
    expect(suggestDomain("hotmial.com")).toBe("hotmail.com");
    expect(suggestDomain("outlok.com")).toBe("outlook.com");
    expect(suggestDomain("yahho.com")).toBe("yahoo.com");
    expect(suggestDomain("iclould.com")).toBe("icloud.com");
    expect(suggestDomain("gmailcom")).toBe("gmail.com");
  });

  it("leaves the real thing alone", () => {
    for (const domain of ["gmail.com", "hotmail.co.uk", "proton.me", "hot.ee"]) {
      expect(suggestDomain(domain)).toBeUndefined();
    }
  });

  it("keeps quiet when it would only be guessing", () => {
    // Nothing like a common domain, and short names where everything is one
    // edit from something.
    expect(suggestDomain("upthink.ee")).toBeUndefined();
    expect(suggestDomain("acme-industries.co.uk")).toBeUndefined();
    expect(suggestDomain("we.com")).toBeUndefined();
  });

  it("asks rather than corrects, and keeps the local part", () => {
    expect(readEmail("First.Last@gmial.com")).toEqual({
      kind: "check",
      email: "first.last@gmial.com",
      suggestion: "first.last@gmail.com",
    });
  });
});

describe("addresses already on file, where nobody can be asked", () => {
  it("sends to anything that could work", () => {
    expect(isSendable("player@gmail.com")).toBe(true);
    expect(isSendable("player@gmial.com")).toBe(true);
  });

  it("stops the ones that would bounce for ever", () => {
    expect(isSendable("player@example.com")).toBe(false);
    expect(isSendable("player")).toBe(false);
    expect(isSendable("")).toBe(false);
    expect(isSendable(null)).toBe(false);
    expect(isSendable(undefined)).toBe(false);
  });
});
