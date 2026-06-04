import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { CartItem as CartItemType } from "@acme/shared";

// CartItem's Link needs a live router; swap it for a plain anchor so the
// component renders standalone.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { CartItem } = await import("./CartItem");

afterEach(() => cleanup());

function makeItem(quantity: number): CartItemType {
  return {
    id: "ci-test",
    personaId: "p-test",
    quantity,
    persona: {
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
    },
  };
}

describe("CartItem", () => {
  // Regression test for issue #26: the minus button at quantity 1 sent an
  // update with quantity 0, which the min-1 server schema rejects with 400,
  // and the UI silently no-ops. The button must be disabled at quantity 1.
  it("disables the minus button at quantity 1 and does not call onUpdateQuantity", () => {
    const onUpdateQuantity = vi.fn();
    render(
      <CartItem
        item={makeItem(1)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={() => {}}
      />,
    );

    const minus = screen.getByRole("button", { name: "-" }) as HTMLButtonElement;
    expect(minus.disabled).toBe(true);

    minus.click();
    expect(onUpdateQuantity).not.toHaveBeenCalled();
  });

  it("enables the minus button at quantity 2 and decrements to 1", () => {
    const onUpdateQuantity = vi.fn();
    render(
      <CartItem
        item={makeItem(2)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={() => {}}
      />,
    );

    const minus = screen.getByRole("button", { name: "-" }) as HTMLButtonElement;
    expect(minus.disabled).toBe(false);

    minus.click();
    expect(onUpdateQuantity).toHaveBeenCalledWith(1);
  });

  it("increments via the plus button regardless of quantity", () => {
    const onUpdateQuantity = vi.fn();
    render(
      <CartItem
        item={makeItem(1)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={() => {}}
      />,
    );

    const plus = screen.getByRole("button", { name: "+" });
    plus.click();
    expect(onUpdateQuantity).toHaveBeenCalledWith(2);
  });
});
