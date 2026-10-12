import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Moment } from "@/lib/model";
import { LOW_EVIDENCE_MESSAGE, NO_EVIDENCE_SCORE_MESSAGE } from "@/lib/sentiment";
import { LowEvidenceNotice, MomentDots, ScoreChip, ScoreValue, SentimentBadge } from "./sentiment";
import { CoverageBar, Sparkline } from "./viz";

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
    ["happy", "Happy", "sent-happy"],
    ["neutral", "Neutral", "sent-neutral"],
    ["unhappy", "Unhappy", "sent-unhappy"],
  ] as const)("renders %s in its colour with an icon and text", (label, text, colour) => {
    render(<SentimentBadge label={label} score={5} />);
    const badge = screen.getByText(text).closest("span")!;
    expect(badge.className).toContain(colour);
    expect(badge).toHaveAttribute("data-label", label);
    expect(badge.querySelector("svg")).not.toBeNull();
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
    expect(screen.getByTitle("Low-confidence score").className).toContain("text-zinc-500");
  });

  it("shows the no-evidence message instead of a null score", () => {
    render(<ScoreValue score={null} lowEvidence />);
    expect(screen.getByText(NO_EVIDENCE_SCORE_MESSAGE)).toBeInTheDocument();
  });
});

describe("ScoreChip", () => {
  it("labels the score, band and provisional flag for screen readers", () => {
    render(<ScoreChip score={3.5} decimals={1} provisional />);
    const chip = screen.getByLabelText("Score 3.5 of 10, provisional, fewer than 3 analysed calls");
    expect(chip).toHaveAttribute("data-band", "unhappy");
    expect(screen.getByText("prov")).toBeInTheDocument();
  });

  it("shows a dash without a score", () => {
    render(<ScoreChip score={null} />);
    expect(screen.getByText("No score")).toBeInTheDocument();
  });
});

describe("CoverageBar, MomentDots and Sparkline", () => {
  it("states coverage in text", () => {
    render(<CoverageBar coverage={{ analysed: 3, total: 4, ratio: 0.75 }} />);
    expect(screen.getByLabelText("3 of 4 calls analysed")).toBeInTheDocument();
    expect(screen.getByText("3/4")).toBeInTheDocument();
  });

  it("states moment counts in text", () => {
    render(<MomentDots negative={2} positive={1} />);
    expect(screen.getByLabelText("2 negative, 1 positive moments")).toBeInTheDocument();
  });

  it("describes the weekly trend and skips empty weeks", () => {
    render(<Sparkline cells={[{ average: 7 }, { average: null }, { average: 4 }]} />);
    expect(screen.getByRole("img", { name: "Weekly average from 7 to 4" })).toBeInTheDocument();
  });
});
