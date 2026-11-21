// Landing footer: newsletter is UI only; share button; contact link.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import Footer, { isValidEmail } from "./Footer";
import { renderWithProviders } from "../../test/helpers";

const UNAVAILABLE = "Newsletter is not available yet. This is a prototype.";

function subscribe(email) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
}

describe("Footer", () => {
  it("isValidEmail accepts normal addresses and rejects bad ones", () => {
    expect(isValidEmail("ali@example.com")).toBe(true);
    expect(isValidEmail("ali@example")).toBe(false);
    expect(isValidEmail("ali example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("a bad email shows an error and marks the field invalid", () => {
    renderWithProviders(<Footer />);
    subscribe("not-an-email");
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("a good email shows the 'not available yet' message and sends nothing", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<Footer />);
    subscribe("ali@example.com");
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-announces the message on a second submit (the text node is replaced)", () => {
    renderWithProviders(<Footer />);
    subscribe("ali@example.com");
    const first = screen.getByText(UNAVAILABLE);
    subscribe("ali@example.com");
    const second = screen.getByText(UNAVAILABLE);
    expect(second).not.toBe(first);
    expect(second.closest("[aria-live='polite']")).toBeInTheDocument();
  });

  it("has the placeholder contact email and 4 column headings", () => {
    renderWithProviders(<Footer />);
    expect(screen.getByRole("link", { name: "hello@mymakanroute.example" })).toHaveAttribute(
      "href",
      "mailto:hello@mymakanroute.example",
    );
    expect(screen.getByRole("link", { name: "Email MyMakanRoute" })).toHaveAttribute(
      "href",
      "mailto:hello@mymakanroute.example",
    );
    // Only Mail and Share: no icon that links back to this same page.
    expect(screen.queryByRole("link", { name: "MyMakanRoute home page" })).not.toBeInTheDocument();
    for (const name of ["Quick Links", "Contact", "Newsletter"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("share copies the page link when the share sheet is missing", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderWithProviders(<Footer />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share this page" })));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/`);
    expect(screen.getByText("Link copied")).toBeInTheDocument();
  });

  it("share uses the share sheet when the browser has one", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, share });
    renderWithProviders(<Footer />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share this page" })));
    expect(share).toHaveBeenCalledWith({
      title: "MyMakanRoute",
      url: `${window.location.origin}/`,
    });
  });
});
