# Pool App — To-Do

## Up Next

### Core features
- [ ] Build My Pools screen (Lap Order / Family Order tabs)
- [ ] **Scraper health alerts** — add a way to get notified when something breaks, e.g. a scraper fetches 0 sessions for a pool that should have sessions (which could mean a URL changed, page restructured, PDF moved, etc.). Could be: GitHub Actions job alerts to poolfinderalerts@gmail.com on scraper error, or a Firestore-based "last successful run" field checked in-app.

### Scrapers to add or fix
- [ ] Roberts Pool — scraper exists but no live closure data available from their website. EBRPD has a general "Park Explorer" monthly e-newsletter (not pool-specific) at https://www.ebparks.org/form/newsletter-sign-up — could surface seasonal closure news but won't give real-time alerts.
- [ ] East Oakland Sports Center — scraper exists but closure dates are hardcoded (Oakland city website blocks automated access)
- [ ] El Cerrito Splash Park — split into two entries: lap/open pool and splash pad have separate session times and separate ticket purchases; should appear as distinct pools so people know what they're buying into

### Gmail closure notice coverage
- [ ] Verify Piedmont + El Cerrito emails surface correctly once those pools send closure notices
- Note: Golden Bear (RecWell), DeFremery, Lions, East Oakland, Roberts have no pool email lists to subscribe to

---

## Done

- Per-pool lap/family filter — lap-only and family-only pools hidden from the wrong mode; toggle in My Pools controls visibility per mode
- Oakland pools email list — confirmed: no email newsletter for DeFremery, Lions, or East Oakland. City has @OPRaquatics on Facebook and OPRAquatics@oaklandca.gov but no signup system. `mailingList: null` is correct.
- Context-sensitive session notes — Emeryville "3 lanes only Mon–Thu" note suppressed on Fridays (fix in scrape-emeryville.js)
- Preferences audit — favorites and pool visibility toggles persist to Firestore per user. Last selected mode and date offset not saved (not worth adding).
- Piedmont split into two entries: Piedmont Competition Pool (piedmont-lap) for lap swim and Piedmont Activity Pool (piedmont-activity) for open/family swim; can now be favorited and hidden independently
- Sign-in screen (Google auth)
- Schedule screen: time-first layout, Lap/Family toggle, day navigation, session type tooltips, freshness banner
- Daily scraper — now 12 scrapers, runs daily at 6 AM Pacific via GitHub Actions
- Figma wireframes V3 complete (10 screens)
- Vercel + GitHub auto-deploy connected
- Albany PDF cache system with hash-check (only calls Claude API when PDF changes)
- Bottom sheet UI — layout fixed (no longer stretches full screen; stays within app bounds)
- King Pool + West Campus July 3 closure verified in Firestore (scraper reads closure dates live from Berkeley PDF)
- My Pools tab now filters correctly — lap-only pools (Emeryville, Golden Bear) don't appear in Family mode; family-only pools (Roberts, East Oakland, El Cerrito) don't appear in Lap mode
- Pool detail sheet now shows email alert status for every pool + "View on Maps" + "View website" buttons
- Per-user preferences in Firestore — favorites (★) and pool visibility toggles saved per user per mode; load on sign-in
- Per-pool on/off toggle in My Pools — toggle switch next to star, separate per mode, saved to Firestore per user
- Onboarding flow — scrapped; users set preferences directly in My Pools tab
- Custom pool order — scrapped; star-first alphabetical sorting is sufficient
- "Report a problem" link added to Settings (opens GitHub Issues)
- Favorite star indicator added to session rows in schedule (★ appears next to pool name for starred pools)
- Calendar emoji replaced with "Today, Jun 29 ▾" style pill label — shows real date, signals it's tappable
- Session row React keys changed to stable poolId+start+end+type composite — fixes key collisions for pools with multiple sessions at the same start time
- Berkeley dive tank (Independent Exercise) and Senior Exercise removed from lap session scraping — were causing duplicate sessions at the same start time as the main lap pool
- Gmail scraper bug fixed: was writing lesson-registration email content as false closure notices; now filters to dates within the 14-day window and verifies the notice text contains a closure keyword
- Fixed duplicate sessions (e.g. King Pool showing twice on July 4): deduplicate in scraper before writing to Firestore, and in Schedule.jsx when reading
- DeFremery Pool added to app with scraper (Mon–Fri 12:30–1:30 PM, Oakland holiday closures from live website)
- Piedmont Community Pool added to app with scraper (June 8 – July 19, competition pool + activity pool)
- Richmond Plunge added to app with scraper (static schedule from city PDF; closed Sundays and July 4)
- Richmond Swim Center added to app with scraper (season June 22–Aug 16 2026; built from city PDF)
- Lions Pool (Oakland) added to app with scraper (June 8 – July 31)
- DeFremery, Lions, and Richmond promoted from "Coming soon" to live in LIVE_POOLS
- Albany July 3 + July 4 closure notices confirmed in Firestore (amber banners showing)
- "Diamond Pool (Oakland)" — confirmed this is Lions Pool (2100 Embarcadero); scraper and entry already added
- **Gmail scraper** — live and running on GitHub Actions
  - Reads inbox via Gmail REST API directly (bypasses googleapis library bug on GitHub Actions runners)
  - Matches sender emails to pool IDs (Albany, Berkeley, Emeryville, Piedmont, El Cerrito, Richmond)
  - Extracts closure dates from email body and writes `closureNotice` to Firestore (surfaces as amber banner in app)
- **Mailing list subscriptions** — poolfinderalerts@gmail.com subscribed to:
  - Albany Aquatic Center — confirmed closure email already received
  - Emeryville city notifications (GovDelivery — public.govdelivery.com/accounts/CAEMERYVILLE)
  - Piedmont Community Pool
  - El Cerrito Splash Park
  - City of Richmond Recreation News Flash (CivicPlus) — covers both Richmond Plunge and Richmond Swim Center
- Fixed Richmond Plunge closure dates: corrected July 3 → July 4 (Independence Day per city PDF); added Aug 15 Plunge Event
- Fixed schedule empty state: Family mode now shows "no sessions found" message instead of blank screen
- Session sort improved: pools now appear alphabetically within each tier (favorites first, then A–Z)
- Holiday closures on schedule — Berkeley reads live from PDF, Emeryville and El Cerrito read live from website, East Oakland writes closure notice, Albany and Golden Bear already correct, Roberts has no live data
