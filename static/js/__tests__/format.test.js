import { describe, it, expect } from "vitest";
import { format } from "../format.js";

describe("format", () => {
  it("shows small numbers as plain integers", () => {
    expect(format(0)).toBe("0");
    expect(format(42)).toBe("42");
    expect(format(999)).toBe("999");
  });

  it("floors fractional values", () => {
    expect(format(3.9)).toBe("3");
  });

  it("abbreviates thousands", () => {
    expect(format(1000)).toBe("1k");
    expect(format(1234)).toBe("1.2k");
    expect(format(999499)).toBe("999.5k");
  });

  it("rolls over to the next tier when rounding overflows", () => {
    expect(format(999999)).toBe("1M"); // 999.999k rounds up
  });

  it("abbreviates millions and beyond", () => {
    expect(format(1_500_000)).toBe("1.5M");
    expect(format(2_000_000_000)).toBe("2B");
    expect(format(1_000_000_000_000)).toBe("1T");
  });
});
