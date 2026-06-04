import { describe, it, expect } from "vitest";
import { db } from "./db.js";

describe("persona search price filters", () => {
  it("minPrice returns only personas priced at or above the threshold", () => {
    const results = db.personas.search({ minPrice: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.price).toBeGreaterThanOrEqual(50);
    }
  });

  it("maxPrice returns only personas priced at or below the threshold", () => {
    const results = db.personas.search({ maxPrice: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.price).toBeLessThanOrEqual(50);
    }
  });

  it("minPrice and maxPrice combine into a band", () => {
    const results = db.personas.search({ minPrice: 50, maxPrice: 70 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.price).toBeGreaterThanOrEqual(50);
      expect(p.price).toBeLessThanOrEqual(70);
    }
  });
});
