import { describe, it, expect } from "vitest";
import { getAsnDisplay, getAsnProviderName } from "./asnLookup";

describe("getAsnDisplay", () => {
  it("returns 'Unknown' for null", () => {
    expect(getAsnDisplay(null)).toBe("Unknown");
  });

  it("returns 'Provider (asn)' for a known ASN", () => {
    expect(getAsnDisplay(16276)).toBe("OVH (16276)");
  });

  it("returns the bare ASN number as a string for an unrecognized ASN", () => {
    expect(getAsnDisplay(999999)).toBe("999999");
  });
});

describe("getAsnProviderName", () => {
  it("returns 'Unknown' for null", () => {
    expect(getAsnProviderName(null)).toBe("Unknown");
  });

  it("returns the bare provider name for a known ASN", () => {
    expect(getAsnProviderName(16276)).toBe("OVH");
  });

  it("returns 'Unknown' for an unrecognized ASN", () => {
    expect(getAsnProviderName(999999)).toBe("Unknown");
  });
});
