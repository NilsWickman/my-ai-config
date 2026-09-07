---
name: tidsrapport
description: Föreslå veckans tidsrapport från ThreadForge/Claude-aktivitet, git och Odoo. Use for "tidsrapport", "tidsrapportering", time reporting, or "hur har jag spenderat min tid" over a week.
disable-model-invocation: true
---

# Tidsrapport

Deliverable: proposed timesheet rows for the week, per task and day, ready to enter in Odoo. Report in the chat, in Swedish, and say explicitly what you left out and what you inflated.

## 1. Aktivitet

Run `scripts/activity.py --from <måndag> --to <söndag>` (no args = current week so far). It reads a ThreadForge SQLite DB and local Claude Code transcripts. Run it on the machine holding the activity data, or connect to that machine over SSH. Set `THREADFORGE_DB` to your database path; without it, only Claude Code transcripts are read. The script uses Europe/Stockholm for day boundaries. With chezmoi the script is installed as `activity.py`; in a direct repo copy its name is `executable_activity.py`. Output: active hours per day and project, with the day's thread titles.

## 2. Git

For each active project, `git log --since/--until` in its repo. Commit subjects are the raw material for descriptions and catch work the thread data missed.

## 3. Fråga användaren

Meetings and off-screen work never appear in the data. Ask for customer and internal meetings per day, and anything done outside the agents. Ask for scheduled working hours for the week as well.

## 4. Odoo

Use the available Odoo integration, or the Odoo UI if no integration is configured:

- Match work to tasks. Use the organisation's project and task structure. Where tasks have parents and children, confirm which task receives the hours.
- Read the already-entered timesheet lines for the week first. Propose only the delta, existing lines are never re-entered.

## 5. Förslag

- Round every cell to quarters (0,25).
- Internal, non-billable rows: honest actual time. Customer rows: proportional to work actually done and expected; reporting more than hours worked or scheduled is allowed.
- Customer-row descriptions are fakturaunderlag: standalone, naming modules, versions and deliverables. Internal rows may be terser.
- One table per task, `| Dag | h | Beskrivning |`, then per-day and week totals checked against the scheduled hours.

## 6. Inmatning

When the user accepts: Timesheets, My Timesheets, grid view, period Week. Verify existing rows, Add a line per task, fill quarters per cell, check the week total bottom right. Descriptions go in afterwards via the list view (the grid has no description field); customer rows always get theirs, they must stand on their own.
