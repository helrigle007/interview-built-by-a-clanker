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
import type { Persona } from "@acme/shared";
import { AuthProvider } from "~/lib/auth";
import { queryClient } from "~/lib/queryClient";
import { routeTree } from "~/routeTree.gen";

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

const user = { id: "u-001", username: "tester", email: "tester@example.com" };

// Records every favorites-mutating call so the test can assert on the verb/path.
interface Call {
  method: string;
  path: string;
}

// Builds a fixture server whose /favorites state is backed by `favoriteIds`,
// a mutable array that POST/DELETE update so a refetch reflects the new state.
function makeFakeFetch(favoriteIds: string[], calls: Call[]) {
  return function fakeFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );

    if (path === "/auth/me" && method === "GET") {
      return json(user);
    }

    if (path === `/personas/${rex.id}` && method === "GET") {
      return json(rex);
    }

    if (path === "/favorites" && method === "GET") {
      const favorites = favoriteIds.map((id) =>
        id === rex.id ? rex : makePersona({ id, name: id }),
      );
      return json({ favorites });
    }

    if (path === "/favorites" && method === "POST") {
      calls.push({ method, path });
      const { personaId } = JSON.parse(String(init?.body ?? "{}")) as {
        personaId: string;
      };
      if (!favoriteIds.includes(personaId)) favoriteIds.push(personaId);
      return json({ success: true });
    }

    if (path.startsWith("/favorites/") && method === "DELETE") {
      calls.push({ method, path });
      const id = path.slice("/favorites/".length);
      const idx = favoriteIds.indexOf(id);
      if (idx === -1) return json({ error: "Favorite not found" }, 404);
      favoriteIds.splice(idx, 1);
      return json({ success: true });
    }

    return json({ error: "not found" }, 404);
  };
}

function renderApp(initialPath: string) {
  // The detail page invalidates the singleton queryClient from ~/lib/queryClient
  // (the same instance main.tsx wires into the provider in production), so the
  // test must render with that same client for invalidation to reach the
  // observed favorites query and re-fill the heart.
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

describe("persona detail favorite toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("auth_token", "test-token");
    queryClient.clear();
    queryClient.setDefaultOptions({
      queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("favorites an unfavorited persona via POST and fills the heart", async () => {
    const favoriteIds: string[] = [];
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(makeFakeFetch(favoriteIds, calls)));

    renderApp(`/personas/${rex.id}`);

    const heart = await screen.findByRole("button", {
      name: /toggle favorite/i,
    });
    // Starts unfilled (not favorited).
    expect(heart.querySelector("svg")?.getAttribute("fill")).toBe("none");

    fireEvent.click(heart);

    await waitFor(() => {
      expect(calls.some((c) => c.method === "POST")).toBe(true);
    });
    // It must add, never delete, an unfavorited persona.
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(favoriteIds).toContain(rex.id);

    // After refetch the heart reflects favorited state.
    await waitFor(
      () => {
        const h = screen.getByRole("button", { name: /toggle favorite/i });
        expect(h.querySelector("svg")?.getAttribute("fill")).toBe(
          "currentColor",
        );
      },
      { timeout: 3000 },
    );
  });

  it("unfavorites a favorited persona via DELETE", async () => {
    const favoriteIds: string[] = [rex.id];
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(makeFakeFetch(favoriteIds, calls)));

    renderApp(`/personas/${rex.id}`);

    const heart = await screen.findByRole("button", {
      name: /toggle favorite/i,
    });
    // Starts filled (favorited).
    await waitFor(() => {
      const h = screen.getByRole("button", { name: /toggle favorite/i });
      expect(h.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
    });

    fireEvent.click(heart);

    await waitFor(() => {
      expect(
        calls.some(
          (c) => c.method === "DELETE" && c.path === `/favorites/${rex.id}`,
        ),
      ).toBe(true);
    });
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(favoriteIds).not.toContain(rex.id);
  });
});
