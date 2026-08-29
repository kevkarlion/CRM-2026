# Migration: Repair missing user names (20260829)

> The `docs/database-migrations/` directory is created in this change.

## What changed

`scripts/repair-user-names.ts` finds `User` documents where `firstName` or
`lastName` is genuinely missing (`null`/empty) or whitespace-only, and auto-fills
only those missing fields with the user's **full email string verbatim**. Its
decoder and the display fallback are centralized in
`src/lib/build-display-name.ts`, so the JWT `name` claim, the client-side decode/
cache (`role-context.tsx`), and the login page cache (`login/page.tsx`) all agree.

## Why

Legacy users bypassed User schema validation and carry `null`/whitespace-only
name fields. Raw interpolation produced the literal junk `"undefined undefined"`
in the header "Hola, {name}". Repairing the stored data and falling back through
email → `'Usuario'` removes the failure class at every layer.

## Impact

- Users with missing/whitespace-only `firstName`/`lastName` get the email string
  as their stored name, which becomes the header fallback.
- Existing non-empty name values are never modified.
- Tokens already issued before the fix self-heal client-side: junk `name`
  claims are rejected and fall back to email → `'Usuario'`.
- No schema, index, or collection changes.

## Execution

```bash
npx tsx scripts/repair-user-names.ts
```

- Idempotent: re-running finds no remaining candidates (every filled field will
  be non-empty), so it is a safe no-op.
- Logs every mutation as `user=<id> field=<field> "<original>" -> "<new>"`.

## Rollback

The per-mutation log in the run output contains the original values. To revert a
given user, restore each logged field to its logged original value (or rely on
`buildDisplayName`, which already handles missing/null names without data
changes). No indexes or schemas are affected, so there is no structural reversal.