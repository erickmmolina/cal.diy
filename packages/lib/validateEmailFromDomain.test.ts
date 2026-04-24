import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateEmailFromAddress } from "./validateEmailFromDomain";

describe("validateEmailFromAddress", () => {
  const ORIGINAL = process.env.ALLOWED_EMAIL_DOMAINS;
  beforeEach(() => {
    process.env.ALLOWED_EMAIL_DOMAINS = "ibero.capital,ibero.legal";
  });
  afterEach(() => {
    process.env.ALLOWED_EMAIL_DOMAINS = ORIGINAL;
  });

  it("allows null/empty", () => {
    expect(() => validateEmailFromAddress(null)).not.toThrow();
    expect(() => validateEmailFromAddress("")).not.toThrow();
    expect(() => validateEmailFromAddress(undefined)).not.toThrow();
  });

  it("allows whitelisted domain (lowercase)", () => {
    expect(() => validateEmailFromAddress("noreply@ibero.legal")).not.toThrow();
  });

  it("allows whitelisted domain (case-insensitive on user side)", () => {
    expect(() => validateEmailFromAddress("Noreply@Ibero.Legal")).not.toThrow();
  });

  it("rejects non-whitelisted domain", () => {
    expect(() => validateEmailFromAddress("x@otra.com")).toThrow(/Dominio no autorizado/);
  });

  it("does not block when env var is unset", () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "";
    expect(() => validateEmailFromAddress("x@otra.com")).not.toThrow();
  });

  it("rejects when address has no @", () => {
    expect(() => validateEmailFromAddress("justtext")).toThrow(/Dominio no autorizado/);
  });
});
