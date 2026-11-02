import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

/**
 * Who pays: ANTHROPIC_API_KEY bills Wilson's monthly Claude credits, then OPENAI_API_KEY bills
 * OpenAI credits, and otherwise AI Gateway (the Vercel bill). Small models are accurate enough on
 * injury timelines and news reading, and cost cents a month.
 */
export const MODELS = [
  ...(process.env.ANTHROPIC_API_KEY ? [anthropic(process.env.AUTO_TAKES_MODEL ?? "claude-haiku-5-5")] : []),
  ...(process.env.OPENAI_API_KEY ? [openai(process.env.AUTO_TAKES_MODEL ?? "gpt-5.4-mini")] : []),
  "anthropic/claude-haiku-5.5",
];

/** Run a call on the first provider that works (a bad or out-of-credit key falls through to the next). */
export async function withModel<T>(call: (model: (typeof MODELS)[number]) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of MODELS) {
    try {
      return await call(model);
    } catch (e) {
      last = e;
      console.error("[ai] model failed, trying the next:", e instanceof Error ? e.message : e);
    }
  }
  throw last;
}

/** Writing (post copy) wants a better writer than news reading: Sonnet first, then the usual chain. About 2 cents a day. */
export const WRITER_MODELS = [
  ...(process.env.ANTHROPIC_API_KEY ? [anthropic(process.env.WRITER_MODEL ?? "claude-sonnet-5-5")] : []),
  "anthropic/claude-sonnet-5.5",
  ...MODELS,
];

export async function withWriter<T>(call: (model: (typeof WRITER_MODELS)[number]) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of WRITER_MODELS) {
    try {
      return await call(model);
    } catch (e) {
      last = e;
      console.error("[ai] writer failed, trying the next:", e instanceof Error ? e.message : e);
    }
  }
  throw last;
}
