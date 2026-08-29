/**
 * Shared, isomorphic-safe name builder for the CRM.
 *
 * Used by the server when minting the JWT `name` claim and by the client when
 * decoding/caching user info, so both sides agree on what a usable name is.
 *
 * Rules:
 * - A part that is `undefined`, `null`, the literal strings "undefined"/"null",
 *   or whitespace-only after trimming is treated as missing.
 * - Usable parts are trimmed and joined with a single space.
 * - If nothing usable results, the email is used; if the email is also
 *   unusable, 'Usuario' is the last resort.
 * - Inputs are never transformed, parsed, or capitalized.
 *
 * This file must stay free of `'use client'`/`'use server'` directives and any
 * server- or client-only dependency so it can be imported from both worlds.
 */

const JUNK_TOKENS = new Set(['undefined', 'null']);
const LAST_RESORT_NAME = 'Usuario';

/**
 * Split a value into usable whitespace tokens, dropping junk.
 *
 * Token-level filtering is required because a token `name` claim already
 * produced by bad interpolation may be the whole string "undefined undefined":
 * it is a single value, yet every token in it is junk.
 */
function usableTokens(value: string | null | undefined): string[] {
  if (value === null || value === undefined) return [];
  return value
    .trim()
    .split(/\s+/)
    .filter((token) => token !== '' && !JUNK_TOKENS.has(token.toLowerCase()));
}

export function buildDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const nameTokens = [...usableTokens(firstName), ...usableTokens(lastName)];
  if (nameTokens.length > 0) return nameTokens.join(' ');

  const emailTokens = usableTokens(email);
  if (emailTokens.length > 0) return emailTokens.join(' ');

  return LAST_RESORT_NAME;
}