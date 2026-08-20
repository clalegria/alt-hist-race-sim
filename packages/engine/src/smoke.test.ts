import { describe, expect, it } from "vitest";
import { SEED_SEASON } from "./index.js";

describe("toolchain", () => {
  it("runs a test against engine source", () => {
    expect(SEED_SEASON).toBe(1980);
  });
});
