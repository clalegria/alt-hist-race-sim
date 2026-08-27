import { describe, expect, it } from "vitest";
import { shortName } from "./names.js";

/**
 * Synthetic names throughout: the rule is about the shape of a name, not about
 * who is in the seed data, and a test that named a real driver would be reading
 * an authored string.
 */
describe("shortName", () => {
  it("keeps the surname and initialises the given name", () => {
    expect(shortName("Michael Schumacher")).toBe("M. Schumacher");
  });

  it("initialises every part of a hyphenated given name", () => {
    expect(shortName("Jean-Pierre Jarier")).toBe("J-P. Jarier");
  });

  it("initialises every given name rather than dropping the middle one", () => {
    expect(shortName("Juan Manuel Fangio")).toBe("J.M. Fangio");
  });

  it("starts the surname at a particle", () => {
    expect(shortName("Emmanuel de Graffenried")).toBe("E. de Graffenried");
    expect(shortName("Giedo van der Garde")).toBe("G. van der Garde");
  });

  it("keeps a suffix on the surname", () => {
    expect(shortName("Nelson Piquet Jr.")).toBe("N. Piquet Jr.");
  });

  it("initialises the given names before a surname that carries a suffix", () => {
    expect(shortName("Jean-Pierre Andre Villeneuve Sr.")).toBe("J-P.A. Villeneuve Sr.");
  });

  it("upper-cases an initial taken from an accented letter", () => {
    expect(shortName("études Fantome")).toBe("É. Fantome");
  });

  it("leaves a one-word name alone", () => {
    expect(shortName("Fangio")).toBe("Fangio");
    expect(shortName("Piquet Jr.")).toBe("Piquet Jr.");
  });

  it("is shorter than the name it came from, whatever its shape", () => {
    // A given name of one or two letters is already as short as "A." — the
    // shortening is only ever a saving from the third letter on.
    for (const name of ["Aaa Bbbbbbbb", "Aaaa Bbbb Cccccccccc", "Aaaa de Bbbbbbb"]) {
      expect(shortName(name).length).toBeLessThan(name.length);
    }
  });
});
