export const PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-opus-4.5": { input: 15.0, output: 75.0 },
  "claude-sonnet-4.5": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  "claude-3-opus": { input: 15.0, output: 75.0 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },

  "gemini-3-pro-preview": { input: 1.25, output: 5.0 },
  "gemini-3-flash-preview": { input: 0.075, output: 0.3 },
  "gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "gemini-3-pro-high": { input: 2.5, output: 10.0 },

  "gpt-5.2": { input: 10.0, output: 30.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },

  "kimi-k2-thinking": { input: 2.0, output: 8.0 },

  "grok-code": { input: 2.0, output: 8.0 },

  "glm-4.7-free": { input: 0, output: 0 },

  "default": { input: 1.0, output: 2.0 }
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING_PER_1M[model] || PRICING_PER_1M["default"];
  return (inputTokens / 1_000_000 * price.input) + (outputTokens / 1_000_000 * price.output);
}
