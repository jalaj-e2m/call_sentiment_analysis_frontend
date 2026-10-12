import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Moment } from "@/lib/model";
import { LOW_EVIDENCE_MESSAGE, NO_EVIDENCE_SCORE_MESSAGE } from "@/lib/sentiment";
import { LowEvidenceNotice, ScoreValue, SentimentBadge } from "./sentiment";

const moment: Moment = {
  id: "m1",
  topic: "delivery delays",
  emotion: "frustrated",
  polarity: "negative",
  intensity: 2,
  quote: "fake quote for tests",
  speaker: "Fake Person",
  timestampSeconds: 10,
  quoteVerified: true,
  reasoning: null,
};

describe("SentimentBadge", () => {
  it.each([
    ["happy", "Happy", "emerald"],
    ["neutral", "Neutral", "amber"],
    ["unhappy", "Unhappy", "red"],
  ] as const)("renders %s in its colour", (label, text, colour) => {
    render(<SentimentBadge label={label} score={5} />);
    const badge = screen.getByText(text).closest("span")!;
    expect(badge.className).toContain(colour);
    expect(badge).toHaveAttribute("data-label", label);
    expect(screen.getByText("5/10")).toBeInTheDocument();
  });

  it("shows Not analysed without a label", () => {
    render(<SentimentBadge label={null} />);
    expect(screen.getByText("Not analysed")).toBeInTheDocument();
  });
});

describe("LowEvidenceNotice", () => {
  it("shows the notice when there are no moments", () => {
    render(<LowEvidenceNotice analysis={{ score: 7, moments: [], dropped: { non_client: 6 } }} />);
    expect(screen.getByRole("note")).toHaveTextContent(LOW_EVIDENCE_MESSAGE);
  });

  it("explains a missing score", () => {
    render(<LowEvidenceNotice analysis={{ score: null, moments: [], dropped: null }} />);
    expect(screen.getByRole("note")).toHaveTextContent(NO_EVIDENCE_SCORE_MESSAGE);
  });

  it("renders nothing when client moments exist", () => {
    const { container } = render(<LowEvidenceNotice analysis={{ score: 7, moments: [moment], dropped: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ScoreValue", () => {
  it("greys out a low-evidence score", () => {
    render(<ScoreValue score={7} lowEvidence />);
    expect(screen.getByTitle("Low-confidence score").className).toContain("text-zinc-400");
  });

  it("shows the no-evidence message instead of a null score", () => {
    render(<ScoreValue score={null} lowEvidence />);
    expect(screen.getByText(NO_EVIDENCE_SCORE_MESSAGE)).toBeInTheDocument();
  });
});
