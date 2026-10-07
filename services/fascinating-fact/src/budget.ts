import { FactError } from "./domain.js";

export const FREE_MODEL = "gpt-5.6-terra";
export const DEFAULT_DAILY_TOKEN_BUDGET = 1_000_000;
export const MAX_INPUT_BYTES = 40_000;
export const MAX_OUTPUT_TOKENS = 4_000;
// UTF-8 bytes conservatively bound byte-level text tokens. Include the entire
// request (instructions, schema and evidence), plus a framing safety margin.
export const INPUT_FRAMING_ALLOWANCE = 4_096;
export const MAX_REQUEST_RESERVATION = MAX_INPUT_BYTES + INPUT_FRAMING_ALLOWANCE + MAX_OUTPUT_TOKENS;

export interface RequestBudget {
  reserve(tokens: number): Promise<void>;
  remainingMs?(): number;
}
export function dailyTokenBudget(value?: string): number {
  const limit = value === undefined ? DEFAULT_DAILY_TOKEN_BUDGET : Number(value);
  return Number.isSafeInteger(limit) && limit > 0 && limit <= DEFAULT_DAILY_TOKEN_BUDGET ? limit : 0;
}
export function reservationFor(body: string): number {
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes > MAX_INPUT_BYTES) throw new FactError("openai_input_limit");
  return bytes + INPUT_FRAMING_ALLOWANCE + MAX_OUTPUT_TOKENS;
}
