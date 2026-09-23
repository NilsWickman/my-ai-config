---
name: email
description: Use to format email responses for the user.
---

# Client email

Mail the user sends to clients, partners, and authorities. The deliverable is a paste-ready mail body, plus a separate pre-send note only when something concrete remains to check or do. The recipient reads a short message from a consultant they trust, not a status report: the session holds the detail, the mail holds what changes for them.

## Before drafting

1. Establish recipient, language (mirror theirs), tier (see Sign-off tiers), and form. Three forms: kort svar when the recipient's mail is a few sentences in an ongoing thread (see Short replies, the default for follow-ups), besked when a fuller answer sits in the session, avstämning when the answer sits with the recipient (see Avstämning), frågeformulär when an avstämning outgrows a mail (see Frågeformulär).
2. Enumerate every question their mail asked. The draft answers each one or defers it explicitly; a skipped question is a defect.
3. Claim audit: list what the draft will assert. Each claim traces to something verified in this session or stated in the thread. An unverified claim is cut or becomes the draft's question. A gap headed for the pre-send note is a claim too: check the delivery history (delivery notes, past sessions) before it survives as a gap.
4. Pin the real next step and its owner, matching how the exchange actually proceeds (who replies, who books, who tests). The mail describes that process, in the user's actual role.
5. When one question plus scheduling would be easier to resolve by phone, suggest a call. Do not replace a requested short reply with a call or an after-call confirmation unless the user chooses that approach.

## Shape

- Greeting per tier, then one line acknowledging what they sent.
- Several issues raised? Open with a playback: a short numbered list of the problems as understood. Playback confirms understanding; solutions come once verified. Playback is for problems they raised, not for material they sent.
- Write at the recipient's altitude: their vocabulary, their consequences. Paths, commands, version numbers, and internal tooling stay in the session.
- At most one question, near the end. A decision that belongs to the counterpart is posed as a choice with a recommendation.
- Close with the concrete next step and its owner. A date appears only once it is already agreed.
- Density mirror: match the length and density of the recipient's own mails. When unsure, halve the draft.

## Short replies in an ongoing thread

These rules replace Shape and Sign-off tiers for the kort svar form.

- Use the user's own sent mails as the style reference. Match the direct, everyday language without copying typos.
- Answer what the recipient needs to know now. Do not repeat known background, attachment descriptions or caveats unless they change the recipient's next action.
- Aim for two to four short sentences when the subject allows it. Omit the greeting or sign-off when the user's example or the mail client's signature already handles it.
- Distinguish ready for testing, our part finished, and the whole delivery complete. Use the user's estimate for the stated milestone and starting condition. If it differs from an earlier estimate, flag the difference briefly outside the draft rather than silently changing the estimate or treating the milestones as equivalent.
- A status update with one straightforward factual question is still a short reply. Draft it directly when the purpose is clear; do not require a preliminary question to the user or switch to the full Avstämning process.
- Add a pre-send note only for a concrete unresolved check or action. Do not append a routine disclaimer or recap.

## Avstämning

Used when the user needs facts or decisions from the recipient before they can act: a peer expert on the other side (payroll consultant, accountant, another firm's technician), a young dialogue, a scope nobody has confirmed. Everything above applies except the rules below.

- Before drafting, establish what the user must be able to do or decide once the reply comes. If the thread already makes that clear, draft directly. Otherwise ask the user one question about that outcome, not about the facts the recipient needs to supply.
- Every claim the audit could not trace becomes a question. That is the question list, not a fallback. Probe, don't prescribe: open questions about how their setup works beat conclusions with confirm-if-wrong assumptions.
- Several questions allowed, replacing the one-question cap. Most important first, one idea per question, never compound. Numbered when more than two.
- One line on what was done suffices; the enumeration stays in the session.
- The next step belongs to the recipient (reply, book). The mail commits the user to nothing beyond reading the answer.
- Density mirror still applies: past five or six questions, or when answers need thought or someone else's input, switch to a frågeformulär.

## Frågeformulär

An avstämning whose questions no longer fit a mail. The questions move into a separate document the recipient fills in async, or that you go through together in a meeting. Everything in Avstämning applies to the questions.

- The mail is a short cover note: what the document is, the decision riding on it, the deadline, and an offer to go through it together.
- Write the document next to the draft as `frageformular-<slug>.md`, in the recipient's language, with these parts in order:
  1. Title and purpose: the decision riding on it and how the answers will be used.
  2. Context: one paragraph for a reader who was not in the session. Enough to answer well, not a page.
  3. How to answer: deadline and rough effort. Partial answers and "vet inte" are useful; ask them to flag uncertainty rather than skip.
  4. The questions, most important first, grouped under headings by theme once there are more than a handful. One idea per question, an empty answer line under each, and a one-line "varför vi frågar" only where the question could be misread or invite a throwaway answer.
  5. A closing catch-all: anything we did not ask that we should know?
- Done when every decision the user named is covered by a question.

## Hard rules

- Commas or plain hyphens; an em-dash never appears.
- Every placeholder is filled from the thread. Anything unfillable moves to the pre-send note as an explicit gap.

## Output format

- Body as plain text at column zero: no blockquote, no indentation, no tables, ready to paste into Outlook or the helpdesk. Bold section labels only in long multi-topic mails.
- Subject line included when starting a new thread.
- Attachments listed after the body by their final filenames, with download links in chat.
- When needed, put the pre-send note last, outside the body: a concrete action, timing-sensitive wording or an unfilled gap that needs attention. Omit it when nothing remains to check or do.

Done when every question from their mail is answered or deferred, every claim traces, and the body needs nothing filled in by hand.

## Sign-off tiers

- Helpdesk ticket: `Hej,` ... `Med vänlig hälsning, <Förnamn>`.
- Known client contact: `Hej <Förnamn>!` ... `Vänliga hälsningar, <Förnamn>` or `MvH, <Namn>`.
- Authority or first contact with an external organisation: formal throughout; sign `Med vänliga hälsningar, <Namn>, <Organisation>` and include org.nr and contact address when the case needs them.

Fill signature placeholders from the user's identity in the conversation; missing identity details belong in the pre-send note.
