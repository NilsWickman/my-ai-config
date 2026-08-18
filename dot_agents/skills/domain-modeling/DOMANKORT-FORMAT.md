# Domänkort format

## Schema

Fixed across all projects — the identical structure is what makes project switching cheap. Section names stay in Swedish; body language follows the project.

```markdown
# <domän> — domänkort
Syfte: <1 rad, affärstermer — vad och varför>
Aktörer: <vem producerar, vem konsumerar, vem äger>

## Språk          <!-- max ~7 begrepp som bär domänen -->
<begrepp>: <1 rads definition> (→ tekniskt namn)

## Flöde          <!-- det centrala flödet, 1-3 rader, i dataflödesordning -->

## Regler         <!-- ska alltid hålla; markera olösta med "öppen fråga" -->

## Avgränsningar  <!-- medvetet utanför scope -->

## Läge <datum>   <!-- 2 rader status + länk till karta/tracker om en finns -->
```

## Rules

- **Hard cap 30 lines.** The cap is a feature: overflow means link deeper, not grow the card.
- **Index, not store.** Gist and link; never restate what a ticket, README, or the code already holds.
- **Språk maps both directions**: domain term → one-line definition → technical name. This section doubles as ubiquitous language for agents, so future sessions name things the way the humans talk.
- **Regler vs Avgränsningar**: Regler must always hold (the contract); Avgränsningar are consciously out of scope. Unresolved rules carry an explicit "öppen fråga" marker so the open reads differently from the decided.
- **Läge is dated** so staleness is visible at a glance. It links to the moving parts (wayfinder map, tracker); the card holds only the stable.
- **Multi-context projects**: one card per bounded context plus a context-map card that only lists the contexts and their relationships. Same schema, more cards — never a longer card.

## Zoom levels

Three renderings of the same content, for different questions:

| Level | Question it answers | When |
|---|---|---|
| **Kort** | "What must I own in 30 seconds?" | Default, every project |
| **Uppslag** | "How do these two projects compare?" | Two cards as A4 sheets side by side |
| **Domänkarta** | "Show me the whole terrain — what am I forgetting?" | Large, messy projects only; overkill for small ones |

- **Uppslag**: two A4 sheets, one project each, sections row-aligned across both sheets (CSS subgrid) so the eye sweeps horizontally — Läge faces Läge, Regler faces Regler. A section with less content gets air, not a shifted layout: empty space is information.
- **Domänkarta**: root carries a one-line truth about the project; one side is the value chain in flow order (numbered), the other side is the stable structure (actors, masterdata, rules, tech). Every leaf carries a status marker. Deep-dives per branch are made on demand, never up front.

## Status vocabulary

Same markers at every zoom level:

- **Green** — exists / proven (tests pass, delivered, validated)
- **Yellow** — pending / to build / open question
- **Square (green)** — load-bearing rule
- **✕ (grey)** — exclusion, deviation, or legacy
- One **identity color** per project, accents only (top edge, flow nodes, markers) — all text in neutral ink tones.

## Rendering

Cards are markdown first; images are for meetings and comparison. Render via the demo-images skill's approach: one self-contained HTML mockup, Playwright element screenshot at deviceScaleFactor 2, output kept next to the mockup in a durable `artifacts/` dir. Content comes from the `DOMAIN.md` files — when a card changes, re-render; the image is never the source of truth.
