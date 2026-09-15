import { describe, expect, test } from "bun:test";
import {
  buildQualityValueSentence,
  getModelFamilyLabel,
  getQualityAndValueFamilies,
  joinWithAnd,
} from "./model-families";
import type { LeaderboardEntry } from "./types";

function makeEntry(
  overrides: Partial<LeaderboardEntry> & { model: string; provider: string },
): LeaderboardEntry {
  return {
    rank: 0,
    percentage: 0,
    timestamp: "2026-01-01T00:00:00Z",
    submission_id: `${overrides.model}-sub`,
    ...overrides,
  };
}

describe("getModelFamilyLabel", () => {
  test("maps known providers to product families", () => {
    expect(getModelFamilyLabel({ provider: "anthropic", model: "claude-sonnet-4.6" })).toBe("Claude");
    expect(getModelFamilyLabel({ provider: "openai", model: "gpt-5" })).toBe("GPT");
    expect(getModelFamilyLabel({ provider: "google", model: "gemini-2.5-pro" })).toBe("Gemini");
    expect(getModelFamilyLabel({ provider: "meta", model: "llama-3.3-70b" })).toBe("Llama");
    expect(getModelFamilyLabel({ provider: "mistralai", model: "mistral-large" })).toBe("Mistral");
  });

  test("falls back to model name patterns when provider is unknown", () => {
    expect(getModelFamilyLabel({ provider: "openrouter", model: "meta-llama/llama-3.1-8b" })).toBe("Llama");
    expect(getModelFamilyLabel({ provider: "together", model: "Qwen2.5-72B" })).toBe("Qwen");
  });
});

describe("joinWithAnd", () => {
  test("formats lists with an Oxford comma", () => {
    expect(joinWithAnd([])).toBe("");
    expect(joinWithAnd(["Claude"])).toBe("Claude");
    expect(joinWithAnd(["Mistral", "Llama"])).toBe("Mistral and Llama");
    expect(joinWithAnd(["Claude", "GPT", "Gemini"])).toBe("Claude, GPT, and Gemini");
  });
});

describe("getQualityAndValueFamilies", () => {
  test("picks top quality families and distinct value families", () => {
    const entries = [
      makeEntry({ provider: "anthropic", model: "claude-opus", average_score_percentage: 0.92, value_score: 2 }),
      makeEntry({ provider: "openai", model: "gpt-5", average_score_percentage: 0.9, value_score: 3 }),
      makeEntry({ provider: "google", model: "gemini-pro", average_score_percentage: 0.88, value_score: 4 }),
      makeEntry({ provider: "mistralai", model: "mistral-small", average_score_percentage: 0.7, value_score: 40 }),
      makeEntry({ provider: "meta", model: "llama-3.3", average_score_percentage: 0.65, value_score: 30 }),
    ];

    expect(getQualityAndValueFamilies(entries)).toEqual({
      qualityFamilies: ["Claude", "GPT", "Gemini"],
      valueFamilies: ["Mistral", "Llama"],
    });
  });
});

describe("buildQualityValueSentence", () => {
  test("builds the FAQ sentence from ranked families", () => {
    const entries = [
      makeEntry({ provider: "anthropic", model: "claude-opus", average_score_percentage: 0.92, value_score: 2 }),
      makeEntry({ provider: "openai", model: "gpt-5", average_score_percentage: 0.9, value_score: 3 }),
      makeEntry({ provider: "google", model: "gemini-pro", average_score_percentage: 0.88, value_score: 4 }),
      makeEntry({ provider: "mistralai", model: "mistral-small", average_score_percentage: 0.7, value_score: 40 }),
      makeEntry({ provider: "meta", model: "llama-3.3", average_score_percentage: 0.65, value_score: 30 }),
    ];

    expect(buildQualityValueSentence(entries)).toBe(
      "Claude, GPT, and Gemini models typically lead on quality, while smaller models like Mistral and Llama offer better value.",
    );
  });

  test("returns an empty string when there are no entries", () => {
    expect(buildQualityValueSentence([])).toBe("");
  });
});
