import { describe, it, expect } from "vitest";
import { getJwtSecret } from "./config.js";

describe("getJwtSecret", () => {
  it("throws a descriptive error when JWT_SECRET is missing", () => {
    expect(() => getJwtSecret({})).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is empty", () => {
    expect(() => getJwtSecret({ JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("returns the secret when set", () => {
    expect(getJwtSecret({ JWT_SECRET: "s3cret" })).toBe("s3cret");
  });
});
