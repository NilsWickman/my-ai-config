---
name: domain-modeling
description: Domänkort and domain model discipline. Use when creating or updating DOMAIN.md or CONTEXT.md, preparing a project overview for a stakeholder meeting, re-entering a project after a context switch, defining or challenging domain terms, building a glossary, or visualizing a domain as a card (domänkort), side-by-side spread (uppslag), or mind map (domänkarta).
---

# Domain Modeling

Two layers, one discipline. The **domänkort** (`DOMAIN.md`) is the compressed top layer: the card a human reads in 30 seconds to own a project's story. Beneath it sits the working model — glossary overflow in `CONTEXT.md`, decisions in ADRs. This skill covers maintaining both *and* the active practice of sharpening the model as you design. (Merely *reading* the files for vocabulary is not this skill — that's a one-line habit. This skill is for when you're changing or presenting the model, not just consuming it.)

## Domänkort — `DOMAIN.md`

Every project carries one `DOMAIN.md` at its root: fixed schema, hard cap 30 lines. The identical structure across projects is half the value — the reader's eyes learn where to look, and a project switch costs 30 seconds. Schema, rules, and visualization (uppslag, domänkarta, status vocabulary) live in [DOMANKORT-FORMAT.md](./DOMANKORT-FORMAT.md); read it before creating or restyling a card.

- The card is an **index, not a store**: a fact lives in one place (code, ticket, doc); the card gists and links. When something doesn't fit, link deeper instead of growing the card.
- Complexity scales in the **number of cards, never card length**: one card per bounded context plus a context-map card, mirroring `CONTEXT-MAP.md`.
- Maintenance rides on the repo's `CLAUDE.md`: "Läs DOMAIN.md först; uppdatera det vid domänändringar; håll taket 30 rader." A session that changes domain terms or behavior updates the card in that same session, never batched.

## File structure

Most repos have a single context:

```
/
├── DOMAIN.md            ← domänkort (the capped card)
├── CONTEXT.md           ← full glossary, only once Språk overflows
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the established language (the card's Språk section, or `CONTEXT.md`), call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Capture terms in the card, overflow to CONTEXT.md

When a term is resolved, write it down right there — never batched. It lands in the card's Språk section while that holds ~7 load-bearing terms; past that, the full glossary moves to `CONTEXT.md` (format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md)) and the card keeps only the bearing few plus a link. Extracting a glossary from a conversation is this same move: terms, ambiguities, and canonical choices land in Språk or `CONTEXT.md`, nowhere else.

`CONTEXT.md` is a glossary and nothing else — no implementation details, no spec, no scratch pad.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).
