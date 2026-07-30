# PoolFinder — Heuristic Usability Audit

**Framework:** Nielsen Norman Group 10 Usability Heuristics  
**Audited:** July 2026  
**Screens covered:** Schedule, My Pools, Pool Detail sheet, Settings

---

## Severity Scale

| Level | Meaning |
|-------|---------|
| 🔴 Critical | Blocks a task or causes irreversible user error |
| 🟠 Major | Causes meaningful confusion, friction, or wasted effort |
| 🟡 Minor | Small polish issues — low friction but worth fixing |

---

## H1 · Visibility of System Status

*Keep users informed about what's happening, at all times.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1.1 | Health warning messages include a developer filename: "check scrape-el-cerrito-pool.js". This is meaningless to users and erodes trust — it looks like an error has leaked from behind the scenes. | 🟠 Major | Replace with a user-facing message: "Schedule data may be outdated — check the pool's website for current hours." Link to the pool's websiteUrl. |
| 1.2 | When a signed-out user taps the star button, the nudge banner appears but disappears after 4 seconds, leaving the star in its unfilled state with no persistent explanation of why. | 🟡 Minor | Keep the nudge for 4 seconds, but also leave a subtle dimmed state on the star (or a small "sign in to save" tooltip label) so the reason doesn't vanish. |
| 1.3 | The "✓ Last updated [date]" freshness banner uses an absolute date ("Jun 29") with no year. If the schedule shows a future date in a new year, this could mislead. | 🟡 Minor | Use relative time ("Updated 6 hours ago") for freshness < 48 hours; fallback to the absolute date format only for older data. |

---

## H2 · Match Between System and the Real World

*Use words, phrases, and concepts familiar to users, not internal jargon.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 2.1 | The schedule displays the start time in the time-block header and the end time as "until 1:30 PM" in each row. Real-world swim schedules show a range ("12:30–1:30 PM"). The split format requires users to connect the header to the row to reconstruct the full window. | 🟠 Major | Show the full time range on each session row: "12:30–1:30 PM". The time-block grouping header can stay but rows should be self-contained. |
| 2.2 | "rECswim" appears as a session type label visible to users, but is an El Cerrito branding name unknown to visitors. | 🟡 Minor | Map it to a plain-language display name in SESSION_TYPES: "Activity Pool Swim" or "Family Swim (rECswim)". The El Cerrito label can stay in parentheses. |
| 2.3 | "Open water" session type appears without a tooltip in Lap mode. Berkeley Marina's description explains tide thresholds, but this is only visible in the pool detail sheet — not inline in the schedule. | 🟡 Minor | Enable session type tooltips in Lap mode too, and add a tooltip for "open-water" that surfaces the tide window inline. |

---

## H3 · User Control and Freedom

*Users need a clearly marked "emergency exit" when they make mistakes.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 3.1 | If a user hides all their pools — easy to do accidentally with toggles — the Schedule shows "No sessions found" with no path to recovery. The user is stuck unless they know to go to My Pools and re-enable pools. | 🔴 Critical | When the filtered session list is empty AND at least one pool is hidden in the current mode, replace the empty state message with: "You've hidden all [Lap/Family] pools. Tap My Pools to manage your settings." Link/button to the My Pools tab. |
| 3.2 | There is no undo after hiding a pool. One tap removes it from the schedule with no confirmation and no way to undo without navigating to a separate tab. | 🟠 Major | Show a brief toast ("West Campus hidden — Undo") with an undo button that lasts ~5 seconds after a pool is toggled off. This is the standard mobile pattern for destructive toggles. |
| 3.3 | Once you navigate forward past Today, there is no "Today" button to jump back — you tap the left arrow repeatedly or open the date picker. | 🟡 Minor | Add a small "Today" pill/button that appears when dayOffset > 0 (hidden on today to avoid clutter). |
| 3.4 | The 13-day schedule limit is a hard constraint not communicated anywhere. If a user tries to plan swim sessions two weeks out, they hit the limit without explanation. | 🟡 Minor | Disable the right arrow at day 13 (already done) and add a tooltip or label on hover/tap: "Schedule available up to 13 days ahead." |

---

## H4 · Consistency and Standards

*Users shouldn't have to wonder whether different words, situations, or actions mean the same thing.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 4.1 | There are two independent Lap/Family mode toggles — one in the Schedule tab and one in the My Pools tab. They are not linked. A user could be viewing Family mode in the schedule while My Pools shows Lap pools, which is confusing when you're trying to manage the pools you see. | 🟠 Major | Lift the `mode` state to the parent (`Schedule.jsx` already owns both tabs) and share it. Both tabs should reflect the same mode at all times. This is the single biggest consistency issue in the app. |
| 4.2 | Pool names in the Schedule tab are underlined links that open the pool's website in a new tab. Pool names in My Pools are tap targets that open the detail sheet. These look almost identical but do completely different things. | 🟠 Major | Differentiate the two visually: in the schedule, the external link could have a small ↗ icon to signal "opens new tab." In My Pools, the chevron (›) already signals navigation, which is good — keep that. |
| 4.3 | The session type in Family mode is a plain blue text button with no border. Blue text reads as a link, not a button. A tooltip trigger should look tappable — not like navigation. | 🟡 Minor | Add a subtle underline-dotted style or a small info icon (ℹ) to signal "tap for info" rather than "navigate to somewhere." |
| 4.4 | "Coming soon" pools appear in My Pools mixed with live pools. They have no star or toggle, making the list visually inconsistent. | 🟡 Minor | Group "Coming soon" pools at the bottom of each city group, or below a light "Coming soon" divider, so they're clearly a separate category. |

---

## H5 · Error Prevention

*Design that prevents problems from occurring in the first place.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 5.1 | The star button (22px font) and toggle switch (38×22px visual) are immediately adjacent in My Pools. On a small screen, it's easy to tap one when intending the other. | 🟠 Major | Increase horizontal gap between the star and toggle to at least 16px. The star could be moved to the left of the pool name instead of the right (like iOS Mail's swipe-to-flag pattern), or the touch target area could be explicitly widened. |
| 5.2 | Sign-in via popup (`signInWithPopup`) can be silently blocked by browser popup blockers. The user sees nothing happen, with no explanation. | 🟡 Minor | Catch the popup-blocked error and show a fallback message: "Popup was blocked. Try allowing popups for this site, or use the Settings tab to sign in." |

---

## H6 · Recognition Rather Than Recall

*Minimize the user's memory load. Options, actions, and information should be visible.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 6.1 | The star's purpose ("Starred pools appear first in the schedule") is only revealed in small gray footer text at the very bottom of the My Pools list — after the entire pool list, easy to scroll past. Users have to discover this through experimentation. | 🟠 Major | Surface this as a brief label when stars are first added, or include it in an empty-state prompt in the starred section of the schedule. At minimum, move the footer note above the pool list or near the star column header. |
| 6.2 | The pool toggle switch has no inline label or explanation. A user encountering it for the first time doesn't know whether they're toggling notifications, visibility, favorites, or something else. | 🟠 Major | Add a column label ("Show in schedule") above the toggle column at the top of the first city group, or show a one-time explanatory label the first time the user loads My Pools. |
| 6.3 | The stale data health warning includes "check scrape-el-cerrito-pool.js" — a file name a user cannot act on. They don't know what this means or what to do next. | 🟠 Major | Replace with "Schedule may be outdated — [View pool website ↗]" linking to the pool's websiteUrl. |
| 6.4 | Session type tooltips are only available in Family mode. In Lap mode, there are no tooltips — so the "Shared with Masters swim" note in session rows has no way to be explained further. | 🟡 Minor | Enable session-type tap-to-explain in Lap mode as well. |

---

## H7 · Flexibility and Efficiency of Use

*Allow users to tailor frequent actions.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 7.1 | There's no direct path from a schedule session row to the pool's detail sheet. If you want to check water temp or lockers before heading to a pool, you have to navigate to My Pools, scroll to find it, and tap. | 🟠 Major | Add a detail sheet trigger to session rows — a small ℹ button or make the pool name open the detail sheet (rather than the external site, which is already accessible from the detail sheet itself). |
| 7.2 | With 20+ pools, finding a specific pool in My Pools requires scrolling through all city groups. No search or filter exists. | 🟡 Minor | Low priority now, but as pool count grows, a search bar at the top of My Pools will become necessary. Worth flagging as a scaling issue. |

---

## H8 · Aesthetic and Minimalist Design

*Avoid irrelevant or rarely needed information.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 8.1 | On holidays or high-closure days, the Schedule tab shows a freshness banner, multiple closure notices, and health warnings before the user ever sees a session. On a 375px iPhone, this can push the actual schedule below the fold entirely. | 🟠 Major | Consider collapsing multiple closure notices of the same type into a single expandable notice (e.g., "3 pools closed today ▾"). Already partially handled by the grouping logic — but could go further. |
| 8.2 | The app header title ("PoolFinder" / "My Pools" / "Settings") is redundant with the active tab label in the tab bar below. The header title takes up space without adding information. | 🟡 Minor | Use the header title for contextual info instead: on the schedule, show the currently selected date ("Wednesday, Jul 30") or the active mode. This makes the header useful, not decorative. |
| 8.3 | "Email alerts" in the pool detail sheet shows "Not subscribed" for several pools — this is app-developer status (the scraper's subscription), not user-facing status. Users don't know who "poolfinderalerts@gmail.com" is or why they'd care whether the app is subscribed to a pool's email list. | 🟡 Minor | Reframe this row as "Schedule updates" with wording like "Auto-updated daily" (for scraped pools) or "Check pool website" (for static pools) — focused on what this means for the user's data quality. |

---

## H9 · Help Users Recognize, Diagnose, and Recover from Errors

*Error messages should be expressed in plain language and suggest a solution.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 9.1 | If Firestore fails to load schedule data, the app silently shows "No sessions found" — identical to a legitimately empty day. The error is logged to the browser console only. Users have no way to know whether the data failed to load or truly no sessions exist. | 🟠 Major | Catch the fetch error in Schedule.jsx and set a separate `error` state. Show a distinct message: "Couldn't load schedule. Check your connection and try again." with a Retry button. |
| 9.2 | All-pools-hidden empty state (see H3.1 above) — "No sessions found" gives no recovery path. | 🔴 Critical | (See H3.1 fix.) |
| 9.3 | Health warnings that say "check scrape-el-cerrito-pool.js" give a diagnosis that users cannot act on. | 🟠 Major | (See H6.3 fix.) |

---

## H10 · Help and Documentation

*Even though it's better to design so no documentation is needed, sometimes help is necessary.*

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 10.1 | New users have no onboarding. On first open, they land directly in the Schedule in Lap mode with no explanation of Lap vs Family, what starring does, or how the toggles work. The app requires discovery. | 🟠 Major | Add a lightweight first-run tooltip or a single informational empty-state screen that appears only when the schedule has no data yet (first load). Could be as simple as two sentences: "Lap mode shows lane swimming sessions. Family mode shows recreational swim." |
| 10.2 | The detail sheet's "Email alerts" row shows subscription status that users haven't set up themselves and may not understand (see H8.3). | 🟡 Minor | (See H8.3 fix — reframe the information rather than add documentation.) |
| 10.3 | Berkeley Marina "open water" swim windows depend on NOAA tide data. The app correctly shows session windows but a user unfamiliar with tide-based swimming might not understand why the hours look unusual or why there's "No lifeguard on duty." | 🟡 Minor | Add one sentence to the Berkeley Marina pool description: "Swim windows are calculated from NOAA tide forecasts — the docks are safe when the tide is at or above 3.5 feet above sea level." |

---

## Summary: Top 10 Fixes by Priority

These are the highest-leverage changes, ordered by impact:

| Priority | Fix | Heuristic |
|----------|-----|-----------|
| 1 | **Empty-state recovery** — When all pools are hidden, show "Go to My Pools to re-enable pools" instead of "No sessions found" | H3, H9 |
| 2 | **Shared mode toggle** — Link the Lap/Family toggle across Schedule and My Pools tabs | H4 |
| 3 | **Replace scraper filename in health warnings** — "check scrape-el-cerrito-pool.js" → "View pool website ↗" | H1, H6, H9 |
| 4 | **Full time range on session rows** — Show "12:30–1:30 PM" instead of splitting start from end | H2 |
| 5 | **Surface the star explanation** — Move "Starred pools appear first" to near the star column, not the bottom footer | H6 |
| 6 | **Hide toggle explanation** — Add a column label or first-time tooltip explaining what the toggle does | H6 |
| 7 | **Undo toast for hide** — "West Campus hidden — Undo" with 5-second timeout | H3 |
| 8 | **Pool detail from schedule** — Make pool name open detail sheet (or add ℹ button); put website link in the sheet | H7 |
| 9 | **Error state for data fetch failure** — Distinguish "no sessions" from "failed to load" | H9 |
| 10 | **Star/toggle tap-target spacing** — Increase gap between star and toggle to reduce accidental taps | H5 |
