#!/usr/bin/env bash
# Claude Code status line: model | git branch | folder | context usage %
input=$(cat)

model=$(jq -r '.model.display_name // "?"' <<<"$input")
dir=$(jq -r '.workspace.current_dir // empty' <<<"$input")
transcript=$(jq -r '.transcript_path // empty' <<<"$input")

branch=""
if [ -n "$dir" ] && git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch=$(git -C "$dir" --no-optional-locks branch --show-current 2>/dev/null)
fi

disp="${dir/#$HOME/\~}"

# Context usage: Claude Code's native percentage is authoritative for most models.
# Fable 5 advertises a larger API window but /context uses its 400k auto-compact
# window, so calculate that model from the payload's current token count instead.
native_pct=$(jq -r '.context_window.used_percentage // empty' <<<"$input")
window=$(jq -r '.context_window.context_window_size // 1000000' <<<"$input")
model_key="$(jq -r '.model.id // empty' <<<"$input") $model"
is_fable=false
case "${model_key,,}" in
  *fable*) is_fable=true; window=400000 ;;
esac

pct=""
if [ "$is_fable" = true ]; then
  tok=$(jq -r '.context_window.total_input_tokens // empty' <<<"$input")
  if [ -n "$tok" ] && [ "$window" -gt 0 ] 2>/dev/null; then
    pct=$(awk -v t="$tok" -v w="$window" 'BEGIN{printf "%.0f", t/w*100}')
  fi
else
  pct=$native_pct
fi

# Fall back to the latest assistant usage entry in the transcript.
if [ -z "$pct" ] && [ -n "$transcript" ] && [ -f "$transcript" ]; then
  tok=$(jq -r 'select(.type=="assistant") | .message.usage | select(. != null) |
        ((.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0))' \
        "$transcript" 2>/dev/null | tail -1)
  if [ -n "$tok" ] && [ "$tok" != "null" ] && [ "$window" -gt 0 ] 2>/dev/null; then
    pct=$(awk -v t="$tok" -v w="$window" 'BEGIN{printf "%.0f", t/w*100}')
  fi
fi

# Last resorts: use the native value if no token count was available, then zero.
[ -z "$pct" ] && pct=$native_pct
[ -z "$pct" ] && pct=0

out="$model"
[ -n "$branch" ] && out="$out | $branch"
printf '%s | %s | ctx: %s%%' "$out" "$disp" "$pct"
