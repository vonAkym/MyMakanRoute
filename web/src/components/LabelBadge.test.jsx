import { render, screen } from "@testing-library/react";
import LabelBadge from "./LabelBadge";

describe("LabelBadge (Hidden Gem Highlighting)", () => {
  test("Hidden Gem shows its text, not colour alone", () => {
    render(<LabelBadge label="Hidden Gem" />);
    const badge = screen.getByText("Hidden Gem");
    expect(badge).toHaveClass("label-badge--gem");
    // The icon is decorative; the text carries the meaning.
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  test("Popular shows its text with the teal style", () => {
    render(<LabelBadge label="Popular" />);
    expect(screen.getByText("Popular")).toHaveClass("label-badge--popular");
  });

  test("no label renders nothing", () => {
    const { container } = render(<LabelBadge label={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
