import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import type { Cart, CartItem, Persona, User } from "@acme/shared";
import { AuthProvider } from "~/lib/auth";
import { queryClient } from "~/lib/queryClient";
import { routeTree } from "~/routeTree.gen";

const user: User = {
  id: "u-001",
  username: "tester",
  email: "tester@example.com",
};

function makePersona(
  overrides: Partial<Persona> & { id: string; name: string },
): Persona {
  return {
    tagline: "A test persona",
    description: "Test description",
    avatarUrl: "https://example.com/avatar.svg",
    specialty: "Engineering",
    capabilities: ["Testing"],
    price: 10,
    rating: 4.0,
    reviewCount: 1,
    tier: "Starter",
    ...overrides,
  };
}

const rex = makePersona({ id: "p-001", name: "Refactor Rex" });

// Mutable in-memory cart so DELETE actually changes what GET /cart returns,
// mirroring the real backend. Reset before every test.
let cart: Cart;

function resetCart() {
  const item: CartItem = {
    id: "ci-001",
    personaId: rex.id,
    persona: rex,
    quantity: 2,
  };
  cart = { items: [item], total: rex.price * item.quantity };
}

function recalcTotal() {
  cart.total = cart.items.reduce(
    (sum, item) => sum + item.persona.price * item.quantity,
    0,
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(String(input));
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname;

  if (path === "/auth/me") {
    return Promise.resolve(json(user));
  }

  if (path === "/cart" && method === "GET") {
    return Promise.resolve(json(cart));
  }

  const itemMatch = path.match(/^\/cart\/(.+)$/);
  if (itemMatch && method === "DELETE") {
    cart.items = cart.items.filter((i) => i.id !== itemMatch[1]);
    recalcTotal();
    return Promise.resolve(json(cart));
  }
  if (itemMatch && method === "PUT") {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const item = cart.items.find((i) => i.id === itemMatch[1]);
    if (item) item.quantity = body.quantity;
    recalcTotal();
    return Promise.resolve(json(cart));
  }

  const personaMatch = path.match(/^\/personas\/(.+)$/);
  if (personaMatch && method === "GET") {
    return Promise.resolve(json(rex));
  }

  return Promise.resolve(new Response("{}", { status: 404 }));
}

function renderApp(initialPath = "/cart") {
  // Use the production singleton queryClient (staleTime 60s,
  // refetchOnWindowFocus false). The cart mutation sites import this exact
  // instance to invalidate, and the nav badge query lives in the same client
  // via the provider below, so this mirrors how invalidation reaches the badge
  // in the real app. The 60s staleTime is what keeps the badge from quietly
  // refetching on its own, which is the condition the bug depends on.
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { queryClient },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

function navBadgeText(): string | null {
  const nav = document.querySelector("nav");
  if (!nav) return null;
  // The cart link is icon-only (no accessible name), so target it by its href.
  const cartLink = nav.querySelector<HTMLAnchorElement>('a[href="/cart"]');
  if (!cartLink) return null;
  // The badge is the span rendered inside the cart link only when count > 0.
  const badge = cartLink.querySelector("span");
  return badge?.textContent ?? null;
}

describe("nav cart badge stays in sync with cart mutations", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("auth_token", "test-token");
    resetCart();
    queryClient.clear();
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("clears the badge after removing the last cart item", async () => {
    renderApp("/cart");

    // Cart page renders the item and the badge shows the qty-2 total.
    await screen.findByText("Refactor Rex");
    await waitFor(() => expect(navBadgeText()).toBe("2"));

    // Remove the only item.
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    // Once the mutation settles the cart is empty, so the badge must no longer
    // read 2. With the badge keyed separately it stays stale at 2 -> failure.
    await waitFor(() => {
      const text = navBadgeText();
      expect(text === null || text === "0").toBe(true);
    });
  });
});
