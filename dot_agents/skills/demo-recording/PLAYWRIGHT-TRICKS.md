# Playwright tricks for recording rich web UIs

Hard-won selector patterns from recording SPA admin UIs (Odoo etc.). Reach for
these when a click times out — read the Playwright call log first; it names
the blocker.

## "element intercepts pointer events" on row hover-checkboxes

List rows that reveal checkboxes on hover often defeat `locator.click()` /
`hover()` (a table overlay intercepts). Bypass the pointer layer with DOM
clicks:

```js
await page.evaluate(() => {
  const boxes = document.querySelectorAll('tbody td.o_list_record_selector input');
  for (let i = 0; i < 2; i++) boxes[i].click();
});
```

`check({ force: true })` is *not* enough when the input is `disabled` until
hover — the DOM `.click()` path works because the app's own delegate handles
it.

## Search: type into the searchbox, not the facet DOM

Building search facets by clicking dropdown internals is brittle. Typing works
almost everywhere:

```js
await page.click('.o_searchview_input');
await page.keyboard.type('Malm IT');
await page.keyboard.press('Enter');
```

For *filters* (not text search), open the filter dropdown and click the
`.o_menu_item` by text, then **wait for the facet to appear** before moving
on — the click can silently miss during animation:

```js
await page.locator('.o-dropdown--menu .o_menu_item:has-text("Health: Critical")').first().click();
await page.locator('.o_searchview .o_facet_value:has-text("Health: Critical")').waitFor();
```

## Empty-state ghosts look like data

Odoo-style list views render greyed *sample rows* when there are zero real
records. A frame review that shows rows may still be an empty list — check for
the overlaid "Create a …" hint text. If seen: the demo data is wrong (e.g.
records created with a different type/stage than the menu filters on).

## Navigate by URL, not by menu clicking

`page.goto(BASE + '/odoo/action-<module>.<action_xml_id>')` (or the app's
deep-link equivalent) is faster and immune to menu re-organizations. Reserve
click-navigation for moments the video should *show* navigation.

## Modals: fields may be prefilled

After opening a wizard from a button, don't assume inputs are empty — filling
an already-prefilled field can double text. Read the modal state first, or
use `fill()` (which clears) rather than `type()`.

## Keep login off camera

Unless the login flow is itself the feature, authenticate before creating the
first recorded page. Two reliable patterns:

1. Authenticate in a throwaway context and save `storageState`, then create the
   recording context with that state.
2. Create the recording context, call its `context.request` authentication
   endpoint, and only then call `context.newPage()`. The request API shares the
   context cookie jar. This is especially useful for Odoo multi-database setups,
   where `/web/session/authenticate` can bind `db`, `login`, and `password`
   without rendering the login page.

If a visible login is explicitly required, submit by clicking the actual submit
button (`button[type=submit]`), then `waitForURL` on the post-login pattern.
Pressing Enter in the password field races SPA bootstrapping in some apps.

## Deterministic pacing

`page.waitForTimeout` between scenes is fine *for recordings* (it is real
time on film). For assertions before an action, prefer `waitFor()` on a
state selector — timeouts hide races that show up as mid-transition frames.
Wait for the scene's stable, user-visible state before adding its caption.

## Prevent flicker at scene boundaries

Record full-page-load scenes in separate contexts/clips. Trim the initial blank
or loading frames from each clip, then use a short 0.3–0.5 s ffmpeg crossfade if
a hard cut flashes. Do not assume the join is clean: inspect exact frames before,
during, and after every transition (`-ss <seconds> -frames:v 1`), and sample at
1 fps around page reloads. Re-record the scene if the flicker is product state,
not merely recording lead-in.

## Always stop() in finally

An unhandled error in a recording script leaves Chromium open, so the node
process never exits — a run that "hangs" instead of failing is almost always
this. Wrap the scene body in `try { ... } finally { await stop(rec); }`.

## Native confirm() dialogs are auto-dismissed

Playwright cancels native `alert`/`confirm` dialogs by default, and nothing
shows in screenshots — an action that "silently does nothing" (e.g. a Remove
that needs confirmation) is often this. Register
`page.on('dialog', d => d.accept())` before triggering the action.

## Suppress recurring overlays from inside the page, do not wait for them

Update banners, cookie bars and "new version available" toasts appear on a
timer, so driver-side handling loses either way: a short `waitFor` misses a
toast that arrives a second late and then leaves product chrome on camera for
the rest of the scene, while a generous timeout is paid in full by every scene
where no toast appears. Split into one clip per scene and that cost is
multiplied by the scene count.

Dismiss it from the page instead, with an init script that costs no wall-clock:

```js
await context.addInitScript(() => {
  const dismiss = () => {
    for (const el of document.querySelectorAll('div')) {
      if (!/^Update Available/u.test(el.textContent || '')) continue;
      el.querySelector('button')?.click();
      return;
    }
  };
  const observe = () => {
    dismiss();
    new MutationObserver(dismiss).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) observe();
  else document.addEventListener('DOMContentLoaded', observe);
});
```

Click the dismiss control rather than removing the node: the toast belongs to
the app's component tree, and deleting it out from under the framework can take
the rest of the UI with it.

An un-dismissed update toast is not only ugly. If the update applies, the app
reloads mid-scene and every piece of state the take had built up — an open
panel, an expanded phase — is gone, while the captions keep narrating it.
`addLocatorHandler` does not cover this: it only fires when an overlay blocks an
action, and a reading beat performs no action at all.
