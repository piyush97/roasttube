import { randomBytes } from "node:crypto";

export const ID_RE = /^[a-z0-9]{8}$/;

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(): string {
  // crypto, not Math.random: report IDs guard private roast data
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ID_ALPHABET[b[i] % 36];
  return s;
}
