import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import type { Persona } from "@acme/shared";
import { AuthProvider } from "~/lib/auth";
import { routeTree } from "~/routeTree.gen";

function makePersona(overrides: Partial<Persona> & { id: string; name: string }): Persona {
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

const rex = makePersona({ id: "p-001", name: "Refactor Rex", specialty: "Engineering" });
const zara = makePersona({ id: "p-002", name: "Zero-Day Zara", specialty: "Security" });
const pete = makePersona({ id: "p-003", name: "Pipeline Pete", specialty: "DevOps" });
const allPersonas = [rex, zara, pete];

// Fixture server: applies the same q/specialty semantics as the real API so the
// test can assert the grid reflects whatever params the client actually sends.
function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input));
  if (url.pathname === "/personas") {
    let results = allPersonas;
    const q = url.searchParams.get("q")?.toLowerCase();
    const specialty = url.searchParams.get("specialty");
    if (q) {
      results = results.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (specialty) {
      results = results.filter((p) => p.specialty === specialty);
    }
    return Promise.resolve(
      new Response(JSON.stringify(results), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return Promise.resolve(new Response("{}", { status: 404 }));
}

function renderApp(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
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

describe("browse page search and filters", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("filters the grid when typing in the search field", async () => {
    renderApp();

    // Full unfiltered grid on initial load.
    await screen.findByText("Zero-Day Zara");
    expect(screen.getByText("Refactor Rex")).toBeDefined();
    expect(screen.getByText("Pipeline Pete")).toBeDefined();

    // Type a query; SearchBar debounces 300ms before pushing it into the URL.
    fireEvent.change(screen.getByPlaceholderText(/search personas/i), {
      target: { value: "zara" },
    });

    // Wait for the refetched, filtered grid — not just the old grid unmounting.
    await waitFor(
      () => {
        expect(screen.getByText("Zero-Day Zara")).toBeDefined();
        expect(screen.queryByText("Refactor Rex")).toBeNull();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("Pipeline Pete")).toBeNull();
  });

  it("refetches when the specialty filter changes", async () => {
    renderApp();

    await screen.findByText("Zero-Day Zara");

    fireEvent.click(screen.getByRole("button", { name: "Security" }));

    await waitFor(
      () => {
        expect(screen.getByText("Zero-Day Zara")).toBeDefined();
        expect(screen.queryByText("Refactor Rex")).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("restores the full grid when the search is cleared", async () => {
    renderApp("/?q=zara");

    await screen.findByText("Zero-Day Zara");
    expect(screen.queryByText("Refactor Rex")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/search personas/i), {
      target: { value: "" },
    });

    await waitFor(
      () => expect(screen.getByText("Refactor Rex")).toBeDefined(),
      { timeout: 3000 },
    );
    expect(screen.getByText("Pipeline Pete")).toBeDefined();
  });
});
