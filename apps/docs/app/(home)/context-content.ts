// Keep the highlights tied to their words, rather than their position in the list.
// This fixed order spreads the selected words across rows without changing on reload.
export const words = [
  { text: "industry intel", tone: "muted" },
  { text: "glossary", tone: "blue" },
  { text: "gotchas", tone: "white" },
  { text: "known edge cases", tone: "muted" },
  { text: "past incidents", tone: "white" },
  { text: "business model", tone: "muted" },
  { text: "failed approaches", tone: "blue" },
  { text: "customer context", tone: "muted" },
  { text: "recurring errors", tone: "white" },
  { text: "blockers", tone: "muted" },
  { text: "architectural decisions", tone: "blue" },
  { text: "unresolved questions", tone: "muted" },
  { text: "rejected alternatives", tone: "white" },
  { text: "product context", tone: "muted" },
  { text: "team members & ownership", tone: "blue" },
  { text: "compatibility constraints", tone: "muted" },
  { text: "rejected designs", tone: "white" },
] as const;

export const tones = {
  muted: "text-neutral-500",
  white: "text-neutral-200",
  blue: "text-sky-200/70",
};

