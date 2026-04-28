@AGENTS.md

## Types & Safety

- Avoid untyped handling and type assertions.
- Use strict equality (`===` / `!==`) always.
- Use proper type guards rather than loose truthiness checks.
- Avoid redundant checks — `typeof x === 'object'` already excludes `undefined`.

## Enums

- Extract enums used in multiple places to a shared/common location.

## Code Quality & Reuse

- Keep code DRY — consolidate repeated logic into reusable functions or hooks.
- Prefer existing utilities, hooks, or libraries (e.g. lodash) over writing custom equivalents.
- For boolean helpers that just validate inputs, prefer a single combined return: `return (a || b) && c`.
- Prefer fewer, more concise lines — but never at the cost of readability.

## Naming & Style

- Use descriptive variable names; no single-letter names.

## Accessibility

- Write alt text that is descriptive and purposeful.
- Consider how whitespace and punctuation affect screen reader output.
