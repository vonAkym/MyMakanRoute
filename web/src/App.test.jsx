// Routing: the landing page has its own Navbar; every other page keeps the AppShell bars.
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithProviders } from "./test/helpers";

describe("App routes", () => {
  it("/ shows the landing page without the AppShell bars", () => {
    renderWithProviders(<App />, { route: "/" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Find Hidden Gems. Plan Your Food Trip",
    );
    expect(screen.queryByRole("navigation", { name: "Main (mobile)" })).not.toBeInTheDocument();
  });

  it("other pages still use the AppShell top bar and bottom nav", async () => {
    renderWithProviders(<App />, { route: "/no-such-page" });
    expect(screen.getByRole("navigation", { name: "Main (mobile)" })).toBeInTheDocument();
    expect(screen.getByText("MyMakanRoute", { selector: ".brand__name" })).toBeInTheDocument();
  });
});
