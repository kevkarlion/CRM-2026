# Migration: Fix duplicated user names from email backfill (20260830)

## What changed

`scripts/fix-duplicated-user-names.ts` repairs `User` documents whose name
fields were polluted by the previous backfill (`scripts/repair-user-names.ts`).
That script filled **every** missing name field with the full email, so users
with both `firstName` and `lastName` missing ended up with both fields holding
the same email — and the header rendered `"ro.lija@hotmail.com
ro.lija@hotmail.com"`.

This migration clears the polluted `lastName`:

1. `firstName` and `lastName` are the **same email value** → `lastName` removed
   (an email is not a surname; display still falls back to `firstName`).
2. `firstName` is an email and `lastName` is a placeholder token (`User`,
   `Usuario`, `undefined`, `null`) → `lastName` removed.

Non-email last names are never touched, even if they look odd.

## Why

The previous backfill was correct about *missing-name* users but wrong about
*users missing both fields*: filling both `firstName` and `lastName` with the
same email made the display name read the email twice. Defense-in-depth was
also added in `src/lib/build-display-name.ts`: consecutive identical tokens
that look like an email address are collapsed, so a repeated email never leaks
into display names again. Real repeated names without `@` (e.g. "José José")
are deliberately NOT collapsed.

## Impact

- Affected 6 users of 12 total in the target database (verified by audit).
- `buildDisplayName('ro.lija@hotmail.com', 'ro.lija@hotmail.com', ...)` now
  returns `ro.lija@hotmail.com` instead of
  `ro.lija@hotmail.com ro.lija@hotmail.com`.
- Existing tokens/JWTs already issued self-heal on next decode (client-side
  `name` is rebuilt through the same helper).
- No schema, index, or collection changes.

## Execution

```bash
npx tsx scripts/fix-duplicated-user-names.ts
```

Dry run prints exactly what would change without writing:

```bash
npx tsx scripts/fix-duplicated-user-names.ts --dry-run
```

- Idempotent: re-running finds no remaining candidates (`lastName` is gone), so
  it is a safe no-op.

## Rollback

The per-mutation log in the run output contains the removed values. To revert a
given user, restore the logged `lastName` to its logged original value. No
indexes or schemas are affected, so there is no structural reversal.