import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StarRating } from "./StarRating";

// Regression test for issue #27: every StarRating instance defined a
// linearGradient with the hardcoded id "half" and referenced url(#half).
// Duplicate ids meant all fractional stars resolved to the first gradient
// in the document, so e.g. a 4.2 rating rendered with a 4.8 card's fill.
describe("StarRating", () => {
  it("gives each instance's gradient a unique id", () => {
    const { container } = render(
      <div>
        <StarRating rating={4.2} />
        <StarRating rating={4.8} />
      </div>
    );

    const gradients = container.querySelectorAll("linearGradient");
    expect(gradients.length).toBe(2);

    const ids = Array.from(gradients).map((g) => g.getAttribute("id"));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids.every((id) => id && id.length > 0)).toBe(true);
  });

  it("fills each fractional star to its own rating fraction", () => {
    const { container } = render(
      <div>
        <StarRating rating={4.2} />
        <StarRating rating={4.8} />
      </div>
    );

    const gradients = Array.from(container.querySelectorAll("linearGradient"));
    const firstStopFractions = gradients
      .map((g) => g.querySelector("stop")?.getAttribute("offset"))
      .map((offset) => Math.round(parseFloat(offset ?? "")));

    // 4.2 -> 20% fill on its 5th star, 4.8 -> 80%
    expect(firstStopFractions).toContain(20);
    expect(firstStopFractions).toContain(80);
  });

  it("ties each instance's fill reference to its own gradient id", () => {
    const { container } = render(
      <div>
        <StarRating rating={4.2} />
        <StarRating rating={4.8} />
      </div>
    );

    // For every gradient, some star in the document must reference it via
    // url(#<id>), and the offset on that gradient must match the fill.
    const gradients = Array.from(container.querySelectorAll("linearGradient"));
    for (const g of gradients) {
      const id = g.getAttribute("id");
      const offset = g.querySelector("stop")?.getAttribute("offset");
      const referencing = container.querySelector(
        `svg[fill="url(#${id})"]`
      );
      expect(referencing).not.toBeNull();
      expect(Math.round(parseFloat(offset ?? ""))).toBeOneOf([20, 80]);
    }
  });

  it("renders no gradient for a whole-number rating", () => {
    const { container } = render(<StarRating rating={4} />);
    expect(container.querySelectorAll("linearGradient").length).toBe(0);
  });
});
