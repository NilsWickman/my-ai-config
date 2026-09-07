#!/usr/bin/env python3
"""Estimate active work time per day from ThreadForge threads and Claude Code sessions.

Usage:
  activity.py [--from YYYY-MM-DD] [--to YYYY-MM-DD]

Defaults to the current week: Monday through today (Europe/Stockholm).

Two measures per day:
- The day total counts HUMAN prompts only: ThreadForge user messages plus
  Claude Code prompts typed at a terminal (entrypoint "cli"). SDK-driven
  lines are excluded: they are ThreadForge lanes (already counted) or
  automation such as the hourly mux health probes. Blocks: gaps up to
  45 min count as continuous work, an isolated prompt counts as 15 min.
- The per-project lines count ALL agent activity (gap 30 min, min 10 min),
  so overnight/background agent runs show up there but never in the total.
  Use the lines for proportions and thread titles, the total for hours.

Hours are rounded to quarters.
ThreadForge DB: $THREADFORGE_DB, optional; unset means Claude Code only.
Claude Code transcripts: ~/.claude/projects/*/*.jsonl
"""
import argparse
import os
import re
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Stockholm")
DEFAULT_DB = ""
CC_DIR = os.path.expanduser("~/.claude/projects")
SWEDISH_DAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]
TS_RE = re.compile(rb'"timestamp":"(2\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})')


def parse_utc(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(TZ)


def blocks_hours(events, gap, min_block):
    total = timedelta()
    if not events:
        return total
    events = sorted(events)
    start = prev = events[0]
    for e in events[1:]:
        if e - prev > gap:
            total += max(prev - start, min_block)
            start = e
        prev = e
    total += max(prev - start, min_block)
    return total


def agent_hours(events):
    return quarters(blocks_hours(events, timedelta(minutes=30), timedelta(minutes=10)))


def human_hours(events):
    return quarters(blocks_hours(events, timedelta(minutes=45), timedelta(minutes=15)))


def quarters(td):
    return round(td.total_seconds() / 3600 * 4) / 4


def threadforge_events(d_from, d_to):
    path = os.environ.get("THREADFORGE_DB", DEFAULT_DB)
    if not path:
        return [], {}
    if not os.path.exists(path):
        print(f"warning: ThreadForge DB not found: {path}", file=sys.stderr)
        return [], {}
    db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    lo = datetime.combine(d_from, time.min, TZ).astimezone(timezone.utc).isoformat()
    hi = datetime.combine(d_to + timedelta(days=1), time.min, TZ).astimezone(timezone.utc).isoformat()
    rows = db.execute(
        """SELECT m.created_at, m.role, p.title, t.title
           FROM projection_thread_messages m
           JOIN projection_threads t USING(thread_id)
           JOIN projection_projects p USING(project_id)
           WHERE m.created_at >= ? AND m.created_at < ?""",
        (lo, hi),
    ).fetchall()
    events = []  # (local_dt, label, is_human)
    titles = defaultdict(set)  # (date, label) -> thread titles
    for created, role, project, title in rows:
        dt = parse_utc(created)
        label = f"ThreadForge · {project}"
        events.append((dt, label, role == "user"))
        titles[(dt.date(), label)].add(title)
    return events, titles


def claude_code_events(d_from):
    events = []
    if not os.path.isdir(CC_DIR):
        return events
    cutoff = datetime.combine(d_from, time.min, TZ).timestamp()
    for proj in os.listdir(CC_DIR):
        pdir = os.path.join(CC_DIR, proj)
        if not os.path.isdir(pdir):
            continue
        label = "Claude Code · " + (re.sub(r"^-home-[^-]+-", "", proj) or proj)
        for fn in os.listdir(pdir):
            fp = os.path.join(pdir, fn)
            if not fn.endswith(".jsonl") or os.path.getmtime(fp) < cutoff:
                continue
            with open(fp, "rb") as f:
                for line in f:
                    m = TS_RE.search(line)
                    if not m:
                        continue
                    if b"exactly the word: pong" in line:
                        continue  # claude-mux lane health probe, not work
                    human = (
                        b'"type":"user"' in line
                        and b'"entrypoint":"cli"' in line
                        and b"toolUseResult" not in line
                        and b'"isMeta":true' not in line
                        and b'"isSidechain":true' not in line
                    )
                    events.append((parse_utc(m.group(1).decode() + "+00:00"), label, human))
    return events


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="d_from")
    ap.add_argument("--to", dest="d_to")
    args = ap.parse_args()

    today = datetime.now(TZ).date()
    d_from = date.fromisoformat(args.d_from) if args.d_from else today - timedelta(days=today.weekday())
    d_to = date.fromisoformat(args.d_to) if args.d_to else today

    tf_events, titles = threadforge_events(d_from, d_to)
    all_events = tf_events + claude_code_events(d_from)

    human_by_day = defaultdict(list)     # date -> [dt], all sources merged
    by_day_proj = defaultdict(list)      # (date, label) -> [dt]
    for dt, label, human in all_events:
        d = dt.date()
        if d_from <= d <= d_to:
            by_day_proj[(d, label)].append(dt)
            if human:
                human_by_day[d].append(dt)

    print(f"Aktivitet {d_from} till {d_to} (Europe/Stockholm)")
    print("Dagstotal = dina prompts. Projektrader = all agentaktivitet, för proportioner.\n")
    d = d_from
    week_total = 0.0
    while d <= d_to:
        total = human_hours(human_by_day.get(d, []))
        week_total += total
        print(f"## {SWEDISH_DAYS[d.weekday()]} {d}: ~{total:g} h egen aktiv tid")
        lines = sorted(
            ((agent_hours(evs), label) for (dd, label), evs in by_day_proj.items() if dd == d),
            reverse=True,
        )
        for h, label in lines:
            line = f"- {label}: {h:g} h agentaktivitet"
            tt = titles.get((d, label))
            if tt:
                line += " · " + "; ".join(sorted(tt))
            print(line)
        print()
        d += timedelta(days=1)
    print(f"Veckans egna aktiva tid: ~{week_total:g} h")


if __name__ == "__main__":
    main()
