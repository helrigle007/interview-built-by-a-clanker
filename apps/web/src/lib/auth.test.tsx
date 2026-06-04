import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { AuthResponse } from "@acme/shared";

vi.mock("./api", () => ({
  api: {
    // never resolves: keeps the /auth/me effect from racing the assertions
    get: vi.fn(() => new Promise(() => {})),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

import { AuthProvider, useAuth } from "./auth";

let auth: ReturnType<typeof useAuth>;

function Capture() {
  auth = useAuth();
  return null;
}

const response: AuthResponse = {
  token: "test-token",
  user: { id: "user-1", username: "citrine", email: "c@example.com" },
};

describe("auth provider sign out", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("login persists the token", () => {
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    act(() => auth.login(response));
    expect(localStorage.getItem("auth_token")).toBe("test-token");
  });

  it("logout removes the persisted token and clears state", () => {
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    act(() => auth.login(response));
    act(() => auth.logout());

    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
  });
});
