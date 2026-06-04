import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@acme/shared";

// PersonaCard's Link needs a live router; swap it for a plain anchor so the
// card renders standalone.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { PersonaCard } = await import("./PersonaCard");

const persona: Persona = {
  id: "p-test",
  name: "Test Persona",
  tagline: "A persona for testing",
  description: "Test description",
  avatarUrl: "https://example.com/avatar.png",
  specialty: "Engineering",
  capabilities: ["Testing"],
  price: 49.99,
  rating: 4.5,
  reviewCount: 10,
  tier: "Pro",
};

describe("PersonaCard", () => {
  // Regression test for issue #2: browse page showed prices multiplied
  // by 100 ($4,999.00 instead of $49.99). price is stored in dollars.
  it("renders the price in dollars, not multiplied by 100", () => {
    const html = renderToStaticMarkup(<PersonaCard persona={persona} />);
    expect(html).toContain("$49.99");
    expect(html).not.toContain("$4999.00");
  });
});
