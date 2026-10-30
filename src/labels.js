// What each label means (SPEC.md 4.1). One source for the picker, the FAQ
// and the note shown to someone who arrives by clicking a badge.
export const MEANINGS = {
  "mostly-ai": "AI produced most of the final work. A person directed, chose and checked it.",
  "human-ai": "A person produced a real share of the final work, and AI helped.",
  "human-only": "No AI in the making, or only spelling-level help.",
};

export const TEST = "Ask: who produced most of the final words, code or images?";
export const BAR_NOTE = "The bar shows the label, not a measured share.";

// Two everyday cases per label, so the line between them is easy to see.
export const EXAMPLES = {
  "human-only": ["An essay you wrote, with a spell-checker fixing typos.", "A photo you took and edited yourself."],
  "human-ai": ["An article you wrote, where AI suggested the outline and tightened sentences.", "An app you coded, where AI wrote some functions you reworked."],
  "mostly-ai": ["An app AI coded while you set the goal and reviewed each change.", "An image AI made from your prompt, which you chose and touched up."],
};

export const TIE_BREAK = "Torn between two? Choose the one with more AI. Being open is the point.";
