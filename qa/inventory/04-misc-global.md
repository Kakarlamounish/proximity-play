# QA Feature Inventory — Misc Pages & Global Chrome (Analytics, Install, Leaderboard, Premium, NotFound, Navigation, Notifications, Theme, PWA, Error Handling)

## Route/Feature: /analytics — Analytics.tsx
**Auth requirement:** logged-in (guard is buggy — see risks)

### UI inventory
- Buttons: none besides the shared `Navigation` bar (no page-local actions/CTAs)
- Inputs/forms: none
- Modals/dialogs: none
- Tabs: Overview, Engagement, Badges, Activity (`Tabs`/`TabsTrigger`, default = Overview)
- Distinct states:
  - Loading (data loading) → full `PageSkeleton`
  - Loaded with data
  - Loaded with zero data (empty states per tab: "No badges earned yet", "No recent activity")
  - Auth-resolved-but-logged-out → intended redirect to `/auth` (see bug below)
- Stat cards: Bubbles Joined, Friends, Messages Sent, Stories Posted (Overview); Story Views, Story Reactions, Engagement Rate (Engagement)
- Progress bars: Active Days (`activeDays/365`, capped 100%), Badges Earned (capped 100%, denominator is `max(badgesEarned+3, 10)` — an arbitrary/moving target, not a real goal count)
- Bar chart: `UsageChart` — 4 bars (Messages/Stories/Bubbles/Friends) scaled to the max value, with a floor of 4% width for any nonzero value so small counts remain visible
- Derived/computed fields (no dedicated backend column): `activeDays = max(1, floor((now - user.created_at)/1 day))`; "Most active feature" badge (ties broken in order Chat > Stories > Bubbles); "Engagement Rate" = `round(reactions/totalStories*100)` (can exceed 100%); "Average views per story" = `round(views/totalStories)`

### Workflows
1. Page mounts → `useEffect` fires `loadAnalytics()` only if `user` is already truthy.
2. `loadAnalytics` runs 5 Supabase count queries in parallel (`Promise.all`) for bubbles, friendships, messages, stories, badges; then conditionally 2 more (views/reactions) only if the user has ≥1 story; then a 6th query for last-10 activities.
3. State is set from all results at once; `loading` flips false in `finally` (so it flips false even if the `Promise.all` threw — see risk).

### Acceptance criteria
1. Given a logged-in user with no activity, all stat cards show 0 and both empty-state tabs ("Badges", "Activity") render their zero-state copy without errors.
2. Given a logged-in user with data, all 4 Overview stat cards reflect exact counts from `bubble_memberships`, `friendships` (either side of the pair), `messages` (as sender only — received messages are not counted), and `location_stories`.
3. "Active Days" progress bar never exceeds 100% and is at least 1 day even for a brand-new account created seconds ago.
4. Engagement Rate and "average views per story" render `0` (not `NaN`/`Infinity`) when `totalStories === 0`.
5. Badges tab lists every row from `user_badges` joined to `badges`, showing icon, name, description, and earned date formatted via `toLocaleDateString()`.
6. Activity tab shows at most the 10 most recent `activities` rows, most-recent first.
7. Navigating to `/analytics` while logged out eventually redirects to `/auth` (see risk — currently does not).
8. A Supabase error during `loadAnalytics` is caught, logged to console, and the page still exits its loading state (does not hang on the skeleton forever).

### Risk-based edge cases
- [High] **Auth guard bug**: the component only destructures `const { user } = useAuth();` — it never pulls the context's real `loading`. Line-level guard `if (!user && !loading) return <Navigate to="/auth" />` actually reads the *local* `const [loading, setLoading] = useState(true)` (the analytics-data-loading flag), not the auth-resolution flag. Because `loadAnalytics()` is only invoked `if (user)`, a genuinely logged-out visitor never flips that local `loading` to `false` — it stays `true` forever, so `!loading` is always `false` and the redirect never fires. A logged-out user hitting `/analytics` directly is stuck on `PageSkeleton` forever instead of being sent to `/auth`. (Compare with `Leaderboard.tsx`/`Premium.tsx`, which correctly destructure `{ user, loading }` from `useAuth()`.)
- [Med] "Engagement Rate" (`reactions/totalStories*100`) has no upper cap and can display >100% if a story gets more reactions than 1 (e.g., 3 stories, 10 reactions → 333%) — reads as a bug to a tester even if arithmetically "correct".
- [Med] All 5 initial queries use one shared `Promise.all` with no per-query error isolation — if any single count query 4xxs (e.g. RLS misconfiguration on one table), the whole load fails, `loading` still gets set false in `finally`, but `analytics` stays at its all-zero initial state with no visible error banner to the user (only a console.error).
- [Med] "Most active feature" logic has a fixed tie-break order (Chat ≥ Stories ≥ Bubbles) that doesn't account for Friends at all, and 0/0/0 always reports "Chat".
- [Low] Badge grid renders `userBadge.badge.icon` and `.name` assuming the joined `badge` is non-null; the `BadgeRow` type marks `badge` as nullable but the JSX does not guard against `null` (`userBadge.badge.icon` would throw if a badge was deleted after being earned).
- [Low] "Badges Earned" progress bar denominator (`max(earned+3, 10)`) is a cosmetic hack, not a real target — value is meaningless as a completion percentage and could confuse testers verifying "percent to next badge tier" (no such tier exists).

---

## Route/Feature: /install — Install.tsx
**Auth requirement:** public (no auth guard at all)

### UI inventory
- Buttons: "Install Now" (disabled when offline)
- Inputs/forms: none
- Modals/dialogs: none
- Distinct states (mutually exclusive, in this priority order):
  1. `installSuccess` banner (green, shown after a successful install, does not auto-hide)
  2. `isInstalled` card ("Already Installed" + feature checklist)
  3. `isInstallable` card ("Install App" + benefits list + Install Now button)
  4. Fallback "Manual Installation" card with OS-specific instructions branching on `isIOS` / `isAndroid` / neither (desktop)
- Device detection: `navigator.userAgent` regex for iOS (`/iPad|iPhone|iPod/`) and Android (`/Android/`) — computed once on mount

### Workflows
1. On mount, detect iOS/Android via UA sniffing.
2. `usePWA()` supplies `isInstallable` (from `beforeinstallprompt` event captured app-wide), `isInstalled` (from `appinstalled` event or `display-mode: standalone` media query), and `isOnline` (`navigator.onLine` + online/offline listeners).
3. Clicking "Install Now" calls `installPWA()` → shows native browser install prompt → on `accepted` sets local `installSuccess = true` (banner shown in addition to, not instead of, the now-stale `isInstallable` card, since `isInstallable` is also flipped false by `usePWA`'s `appinstalled` handler, moving the UI to the "Already Installed" branch on the next render).

### Acceptance criteria
1. On a browser that fires `beforeinstallprompt` (e.g. Chrome/Edge desktop or Android Chrome), the page shows the "Install App" card with 5 benefit bullets and an enabled "Install Now" button while online.
2. "Install Now" is disabled and shows "Please connect to the internet to install" whenever `navigator.onLine` is false.
3. Accepting the native install prompt shows the green "installed successfully" banner and the page state transitions to "Already Installed" without requiring a reload.
4. Dismissing/cancelling the native prompt does not show the success banner and leaves the user on the installable card (able to retry).
5. On iOS Safari (no `beforeinstallprompt` support), the manual-instructions card shows the iOS-specific 4-step "Add to Home Screen" instructions.
6. On Android Chrome when the browser hasn't fired the install event yet (or already dismissed it this session), the Android-specific manual instructions show.
7. On desktop/other browsers with no install support, generic "look for an install button in your browser" copy is shown.
8. Visiting `/install` while already running as an installed PWA (`display-mode: standalone`) immediately shows "Already Installed" without needing user interaction.

### Risk-based edge cases
- [High] No auth guard — page is fully public; not a security issue per se, but inconsistent with the rest of the app (every other page in this slice redirects unauthenticated users). QA should confirm this is intentional (marketing/onboarding page) rather than an oversight.
- [Med] UA sniffing for iOS/Android is done once in a `useEffect` with `navigator.userAgent` regex — will misclassify iPadOS 13+ Safari in desktop mode (reports as Mac UA, not `iPad`), landing such users on the generic "Desktop/Other" branch instead of iOS instructions.
- [Med] `installSuccess` state never resets — if a user's browser somehow re-fires the installable flow after already succeeding once (e.g. app was uninstalled and prompt reappears), the stale green banner logic still gates only on the local boolean, which is fine on this mount, but there is no cross-session persistence check to avoid re-showing "Install Now" right after a fresh install if `appinstalled` fires late.
- [Low] `isOnline` is derived solely from `navigator.onLine`, which is unreliable on some browsers/OSes (can report `true` on a captive portal with no real connectivity) — install could still fail despite the button being enabled.
- [Low] Manual instructions are static copy (menu wording like "three dots") that can drift from actual current browser UI text after OS/browser updates.

---

## Route/Feature: /leaderboard — Leaderboard.tsx
**Auth requirement:** logged-in (correct guard: `const { user, loading } = useAuth()`)

### UI inventory
- Buttons: back button (`ChevronLeft`, `navigate(-1)`)
- Inputs/forms: none
- Modals/dialogs: none
- Tabs: Global, Friends, Streaks, Badges (default = Global)
- Distinct states:
  - `busy` (initial fetch) → "Loading…" text only in the Global tab (Friends/Streaks/Badges tabs do not show a busy indicator, only their own empty-state text, which can misleadingly display before data has loaded — see risk)
  - Empty states per tab ("No scores yet — start snapping!", "Add friends to see how you stack up.", "No active streaks...", "Explore the map and join bubbles to earn badges.")
  - Populated list rows
- "My summary" card: medal/rank (🥇🥈🥉 or `#N`, or `—` if not ranked in global top 50), total snap score, best streak (max across all `streaks`)
- Streak rows show "Expires in Nh" (pulsing destructive badge) when `hoursLeft < 4`, else "Active"

### Workflows
1. On `user` present, fires one big `load()` async function (not re-entrant-guarded beyond a `cancelled` flag) that sequentially: fetches top-50 global `snap_scores`, joins profiles; computes friend IDs from `friendships`; builds a friends-only list by filtering the top-50 set and then fetching any friend scores missing from that set; fetches `snap_streaks` for the user and joins partner profiles; fetches `user_badges` joined to `badges`.
2. `myRank` and `myScore` are derived from the global top-50 array only — a user outside the top 50 will show rank `—` even though the "Your Snap Score" number is still correct (looked up separately in step 1).

### Acceptance criteria
1. Global tab lists at most 50 rows, ordered by `total_score` descending, each showing medal/rank, avatar, first name, snaps sent/received, stories posted, and total score.
2. The current user's own row (if present) is visually distinguished (`bg-primary/10`, "(you)" label) in the Global list.
3. Friends tab includes the current user plus all accepted friends' scores (pulled from `snap_scores` even if a friend isn't in the global top 50), sorted by score descending.
4. Streaks tab lists every `snap_streaks` row involving the user, sorted by `streak_count` descending, and flags any streak with under 4 hours left before expiry with a pulsing "Expires in Nh" badge.
5. Badges tab lists every earned badge for the current user, most recently earned first.
6. "My summary" card's rank shows `—` (not `#51` or blank) when the user's total score doesn't place in the top 50.
7. "Best streak" shows `0` (not blank/NaN) when the user has no streaks.
8. Visiting `/leaderboard` while logged out redirects to `/auth`.
9. Back button navigates to the previous history entry, not hardcoded to a specific route.

### Risk-based edge cases
- [High] Only the Global tab shows a loading indicator (`busy` guards only that tab's branch); Friends/Streaks/Badges tabs check only their own array's `.length === 0`, so during the initial load (before any data has arrived) those three tabs show their "empty" copy (e.g. "Add friends to see how you stack up.") even though data simply hasn't loaded yet — a tester could easily mistake this for "no friends" when it's actually still loading.
- [Med] `hoursLeft` for streak expiry is computed as `24 - (Date.now() - last_snap_at)/3600000` with no floor — a `last_snap_at` older than 24h (streak should already be dead server-side) yields a negative `hoursLeft`, and `expiring` is true, and the displayed text uses `Math.max(0, round(hoursLeft))` so it would show "Expires in 0h" for an already-broken streak rather than removing/marking it broken — implies a possible server/client desync in streak lifecycle state.
- [Med] Friends-list building does a second Supabase round trip only for friend IDs "missing" from the already-fetched top-50 — if a friend has literally never sent/received a snap (no `snap_scores` row at all), that friend silently never appears in the Friends tab (query returns no row for them, and nothing pads the list with a zero-score placeholder).
- [Low] `medal()` helper special-cases only ranks 0/1/2; tied scores at rank boundaries (e.g., two users tied for 2nd/3rd) get different medals purely from array order/stable sort tie-breaking, which may look arbitrary/unfair to users.
- [Low] No pagination beyond top 50 in Global tab — a user ranked 51+ has no way to see their real numeric rank anywhere in this UI besides the "—" placeholder.

---

## Route/Feature: /premium — Premium.tsx
**Auth requirement:** logged-in (correct guard: `const { user, loading } = useAuth()`)

### UI inventory
- Buttons: "Get Pro" / "Get Elite" (per-plan checkout CTA, each independently disabled while its own `checkoutLoading` is active)
- Inputs/forms: none (no payment form is ever rendered client-side)
- Modals/dialogs: none
- Distinct states: default only — no branching UI for "already subscribed"/"already Pro"/"already Elite" (see risk)
- Sections: Hero banner; 2 plan cards (Pro $4.99/mo, Elite $9.99/mo) each listing included feature titles with checkmarks; "Locked Features (Preview)" list of every non-free feature shown with a lock icon regardless of what the user actually has; footer trust copy ("Secure payment via Stripe", "we never sell your location data")
- Also exports `PremiumBadge` (small pill used elsewhere in the app to badge Pro/Elite users) — not itself part of this page's rendered UI but defined in this file

### Workflows
1. Clicking "Get {Plan}" calls `handleCheckout`.
2. `handleCheckout` reads `VITE_STRIPE_PUBLIC_KEY` via a safe `import.meta.env` accessor; if unset or still the literal placeholder string `'your_stripe_key'`, shows a destructive toast ("Stripe not configured") and returns — **no checkout occurs**.
3. If a key is configured, shows a success-style toast ("Redirecting to Stripe checkout...") but the actual redirect (`window.location.href = checkoutUrl`) is commented out — nothing happens after the toast; no Supabase edge function call is wired up despite the comment describing one.
4. `checkoutLoading` is set to the plan id then cleared in `finally`, but because no network call awaits inside the `try`, the loading spinner is essentially instantaneous regardless of Stripe key state.

### Acceptance criteria
1. Visiting `/premium` while logged out redirects to `/auth`.
2. With no Stripe key configured (default/dev state), clicking either "Get Pro" or "Get Elite" shows a destructive "Stripe not configured" toast and does not navigate away or charge anything.
3. Each plan card lists exactly its tier's features: Pro shows the 5 pro-tier features; Elite shows all 5 pro-tier features plus the 4 elite-tier features.
4. The "Locked Features" preview section lists every feature tagged `pro` or `elite` (9 total) regardless of the viewing user's actual plan.
5. Clicking a plan's button shows a loading spinner only on that plan's button, not both simultaneously.
6. `PremiumBadge` renders a violet gradient "Pro" pill for `tier="pro"` and an amber gradient "Elite" pill for `tier="elite"`.

### Risk-based edge cases
- [High] **No functional payment/subscription flow exists anywhere in the codebase.** A grep for tier/subscription state (`subscription_tier`, `is_premium`, etc.) across `src/` finds no matches outside this one file — there is no persisted concept of a user's plan. This page is a pure UI mock: even with a real Stripe key configured, the actual redirect line is commented out, so **no path in this codebase currently lets a user complete a purchase or have "Pro"/"Elite" reflected anywhere else in the app** (e.g., `PremiumBadge` is exported but nothing computes which tier to pass it based on real user state). This should be flagged as a hard blocker/known-gap before "real user testing," not just an edge case.
- [High] The page has no way to detect or display "you're already on Pro/Elite" — a paying user (hypothetically) would still see both upgrade cards and both CTAs as if they'd purchased nothing, risking duplicate charges in a real integration.
- [Med] `getEnv` swallows all errors and silently returns `''` — if `VITE_STRIPE_*` envs are missing at build time in a given deployment, the failure mode is a generic toast with no indication to devs/QA of *which* env var is missing.
- [Med] Price IDs fall back to placeholder strings (`price_pro_placeholder`) that are never validated against the configured public key — a half-configured environment (key set, price ID not) would pass the "Stripe not configured" check and proceed to a broken checkout silently.
- [Low] Toast in `handleCheckout`'s `catch` references `err.message` on an `any`-typed catch variable with no narrowing/guard for non-Error throws.

---

## Route/Feature: `*` NotFound — NotFound.tsx
**Auth requirement:** public

### UI inventory
- Buttons/links: single "Return to Home" anchor (`<a href="/">`, a hard full-page navigation, not a React Router `<Link>`)
- Inputs/forms: none
- Modals/dialogs: none
- Distinct states: single static state (no loading/error variants)

### Workflows
1. Any unmatched route renders this component (registered as `<Route path="*">` in `App.tsx`, wrapped in its own `ErrorBoundary`).
2. On mount, logs `console.error("404 Error: User attempted to access non-existent route:", location.pathname)`.
3. "Return to Home" is a plain `<a href="/">`, causing a full browser reload rather than an SPA transition.

### Acceptance criteria
1. Any URL not matching a defined route (e.g. `/this-does-not-exist`, typoed paths, stale deep links) renders this 404 page instead of a blank screen or crash.
2. The attempted path is logged to the console for diagnostics.
3. Clicking "Return to Home" navigates to `/` (which itself may then redirect further, e.g. to `/auth` if logged out, per app-wide routing).
4. Page renders correctly with no dependency on auth state (works identically logged in or out).

### Risk-based edge cases
- [Med] Uses a hard `<a href="/">` instead of `<Link to="/">` — loses all React Router/SPA state (query client cache, in-memory stores) on click, causing a full reload; likely unintentional given the rest of the app is SPA-routed.
- [Low] No visual differentiation from the rest of the app's design system (uses `bg-gray-100`/plain Tailwind grays rather than the app's `bg-background`/theme tokens) — will look "broken"/unthemed in dark mode.
- [Low] No "did you mean" / search / nav links back into the app's main sections — a lost or confused user has only one exit path.

---

## Global Feature: Navigation — Navigation.tsx
**Auth requirement:** renders regardless of auth state; profile data (name/avatar) and pending-friend-request badge only populate when a user is logged in

### UI inventory
- Buttons: mobile menu toggle (hamburger ⇄ X), theme toggle (desktop only), search dialog trigger (`SearchDialog`, both desktop and mobile), notification bell (`NotificationCenter`, both desktop and mobile), camera shortcut icon (desktop only, `sm:flex`, hidden below `sm`)
- Inputs/forms: none directly (search lives inside `SearchDialog`)
- Modals/dialogs: none directly owned (mobile menu is an in-DOM sliding panel, not a portal dialog); backdrop overlay (`fixed inset-0`) closes the mobile menu on click
- Distinct states: mobile menu open/closed; active-route highlighting (`isActive` compares exact `location.pathname` match — no partial/prefix matching); logged-in vs logged-out (name/avatar fall back to `null`/"User"/`/placeholder.svg`)

### Full nav destination inventory
**Desktop primary nav bar / mobile primary list (`navLinks`, in this exact order):**
1. `/dashboard` — "🏠 Dash"
2. `/messages` — "💬 Chat"
3. `/discover` — "🔍 Discover"
4. `/stories` — "📖 Stories"
5. `/` — "🗺️ Snap Map"
6. `/friends` — "👥 Friends" — **badge**: `pendingRequestCount` (see below)
7. `/calls` — "📞 Calls"
8. `/live` — "📡 Live"
9. `/leaderboard` — "🏆 Scores"

**Logo/brand area:** `/` (logo + "Proximity Play" wordmark) and `/camera` (camera icon shortcut, desktop-only via `hidden sm:flex`)

**Right-side icons (desktop):** `NotificationCenter` (see below), `SearchDialog`, `ThemeToggle`, `/settings` (⚙️ icon link), `/profile` (avatar + name link)

**Right-side icons (mobile, `lg:hidden`):** `SearchDialog`, hamburger/X toggle only — **no `ThemeToggle` and no direct `/settings` icon in the collapsed bar** (settings is reachable only after opening the mobile menu)

**Mobile-menu-only extra links** (below the primary `navLinks` list, inside the expanded panel, in order):
- `/?sheet=memory-lane` — "🔥 Memory Lane" (query-param-driven sheet trigger, not its own route)
- `/ar` — "📷 AR View"
- `/live` — "📡 Live Sharing" (**duplicate** of `/live` already in the primary list above it)
- `/leaderboard` — "🏆 Leaderboard" (**duplicate** of `/leaderboard` already in the primary list)
- `/analytics` — "📊 Analytics"
- `/premium` — "👑 Go Premium"
- `/settings` — "⚙️ Settings"
- `/profile` — avatar + name + "View Profile" (footer-style row)

**Note:** `/ar`, `/analytics`, `/premium`, and `/?sheet=memory-lane` are reachable **only from the mobile menu** — there is no desktop-nav entry point to Analytics, Premium, AR View, or Memory Lane at all (desktop users can only reach them via direct URL, the `SnapBottomNav`/`QuickActionsFAB` global components mounted separately in `App.tsx`, or in-app links elsewhere).

### Badge/counter logic
- **Friends badge** (`pendingRequestCount`): queried on mount (and on auth change) via `count` on `friend_requests` where `receiver_id = current user` and `status = 'pending'`; kept live via a Supabase Realtime channel (`nav-friend-request-count`) subscribed to `postgres_changes` (`event: '*'`) on `friend_requests` filtered to `receiver_id = current user`, which just re-runs `fetchCount()` on any change (insert/update/delete) rather than incrementally updating — every change triggers a full refetch. Badge is only rendered when `badge > 0` (both desktop pill and mobile inline badge); no cap/formatting for large counts (e.g. "137" renders as-is, unlike the 99+ cap used in `NotificationCenter`).
- **Notification bell badge**: delegated entirely to `NotificationCenter` (own unread count, see below) — Navigation does not compute or duplicate this count itself.

### Workflows
1. On `authUser` change: fetch `profiles.first_name`/`profile_photo_url` for display name/avatar, falling back to `authUser.email` then `'User'`, and to `user_metadata.avatar_url` then `null` (→ `/placeholder.svg`) — also re-subscribes to `supabase.auth.onAuthStateChange`, clearing name/avatar immediately on sign-out (`!session`).
2. On `authUser` change (separate effect): fetch pending friend-request count and subscribe to realtime updates on `friend_requests`; unsubscribes/removes channel on cleanup or auth change.
3. Mobile menu toggle shows/hides an expanded panel with a translucent backdrop; clicking any link inside it also closes the menu (`onClick={() => setIsMobileMenuOpen(false)}`) but the backdrop `<div>` itself does **not** appear to close the menu... (it does — `onClick` sets `isMobileMenuOpen(false)`) confirmed correct.
4. `isActive` uses **exact** pathname equality — a route like `/settings/notifications` (if it existed) would not highlight the `/settings` link as active; also `/` (Snap Map) and `/dashboard` (Dash) are visually distinct entries so no ambiguity there.

### Acceptance criteria
1. All 9 primary `navLinks` render in both desktop (`lg:` breakpoint and above) and mobile (below `lg:`) layouts, in the exact order listed above.
2. The currently active route's nav link is visually highlighted (`bg-primary` pill) in both desktop and mobile renderings, matched by **exact** pathname only.
3. The Friends nav item shows a numeric badge only when the logged-in user has ≥1 pending incoming friend request; the badge updates in real time (within one realtime round-trip) when a request is sent/accepted/declined, without requiring a page refresh.
4. Logged-out users see the nav bar with no name/avatar failures (falls back to generic "User" + placeholder image) and no crash from the friend-request-count effect (it's gated behind `if (!authUser) return;`).
5. Opening the mobile menu (hamburger tap) reveals all primary links plus the 8 extra links (Memory Lane, AR View, Live Sharing, Leaderboard, Analytics, Go Premium, Settings, Profile); tapping any link or the backdrop closes the menu.
6. Desktop users can reach every one of: Settings, Profile, Search, Theme toggle, Notifications directly from the persistent bar without opening any menu.
7. `/camera` shortcut icon is visible next to the logo on `sm:` and above, hidden on the smallest breakpoints.
8. Signing out clears the displayed name/avatar and pending-request badge without requiring a manual refresh (via the `onAuthStateChange` listener).

### Risk-based edge cases
- [High] **Desktop users have no direct nav entry to Analytics, Premium, or AR View** — those 3 routes (plus the Memory Lane sheet) exist only inside the `lg:hidden` mobile menu markup. A desktop tester following "click through every page from the nav" will conclude these pages are unreachable/missing unless they also check other entry points (FAB, deep links, in-page CTAs) — worth confirming this is intentional (e.g., reachable via `SnapBottomNav`/`QuickActionsFAB` instead) rather than a leftover from mobile-first development.
- [Med] Mobile menu duplicates `/live` and `/leaderboard` (once in the primary `navLinks` list rendered at the top of the panel, again in the "extra links" block below it) — two differently-labeled links ("📡 Live" vs "📡 Live Sharing", "🏆 Scores" vs "🏆 Leaderboard") pointing at the same route; confusing during exploratory testing and a likely copy/paste leftover.
- [Med] The realtime friend-request-count subscription refetches the **full count** on every single `postgres_changes` event (any INSERT/UPDATE/DELETE touching the filter) rather than incrementing/decrementing locally — under bursty request activity this creates redundant round-trips and brief count flicker/staleness between the DB write and the refetch completing.
- [Med] Friends badge count has no display cap (unlike Notification bell's "99+") — a user with e.g. 250 pending requests would show a misshapen "250" digit blob in the small circular badge (`min-w-[18px] h-[18px]`), a layout risk.
- [Low] `isActive` exact-match means any future nested route under an existing top-level path (e.g. a hypothetical `/settings/privacy`) would not highlight its parent nav item — not a bug today (no nested routes currently exist under nav items) but a latent gap.
- [Low] Avatar `<img>` has no `onError` fallback — if `profile_photo_url` points to a deleted/broken image URL, the broken-image icon shows instead of falling back to `/placeholder.svg`.

---

## Global Feature: NotificationCenter.tsx
**Auth requirement:** renders an icon regardless of auth state, but data loading/subscriptions are gated on a logged-in user

### UI inventory
- Buttons: bell icon trigger (opens `Sheet`), "Mark all read" (header, shown only when `unreadCount > 0`), per-notification "Mark read" (shown only on unread items), per-notification delete (trash icon, always visible)
- Inputs/forms: none
- Modals/dialogs: `Sheet` slide-over panel (`w-full sm:max-w-md`)
- Distinct states: empty ("No notifications yet"), populated list (unread items visually distinct via `bg-primary/5 border-primary/20`), unread pulse-ring + red bell + numeric badge (caps at "99+") when `unreadCount > 0`
- Icon mapping by `type`: `message`→💬, `friend_request`→👥, `bubble_activity`→🪷, `meetup`→📍, `story_reaction`/`like`→❤️, `missed_call`→📞, default→🔔

### Workflows
1. On `user` present: `loadNotifications()` fetches the latest 50 `notifications` rows (all types, not filtered by `user_id` in the query itself — see risk), computes `unreadCount` from the fetched page.
2. `useRealtimeNotifications` subscribes to `INSERT` on `notifications` filtered server-side to the current user; on a new row: prepends it locally, increments `unreadCount`, fires a `sonner` toast, and — only if the tab is not currently visible (`document.visibilityState !== 'visible'`) — also fires a browser/OS-level notification via `showSystemNotification` (which itself no-ops unless `Notification.permission === 'granted'`).
3. Opening the sheet (`isOpen` → true) auto-marks all currently-loaded notifications as read (bulk `UPDATE ... WHERE user_id = X AND read = false`), mirroring "WhatsApp behaviour" per the inline comment — fires on every open while `unreadCount > 0`, including immediately after a fresh unread notification arrives while the sheet is already open (re-triggers because `unreadCount` is in the effect's implicit closure via the eslint-disabled deps array using only `[isOpen]`).
4. Delete removes the row from Supabase and from local state; does not decrement `unreadCount` if the deleted notification happened to be unread (see risk).

### Acceptance criteria
1. Bell shows a pulsing ring, red tint, and a numeric badge (capped "99+") whenever `unreadCount > 0`; shows plain gray bell with no badge when 0.
2. Opening the panel loads and displays the 50 most recent notifications, newest first, each with the correct type-based emoji icon.
3. Opening the panel with any unread notifications present marks all of them read within the same interaction (bulk update) and clears the badge to 0.
4. Receiving a new notification while the app is backgrounded/hidden triggers both an in-app toast (via `useRealtimeNotifications`' own toast) and, if permitted, an OS-level notification via `showSystemNotification`; while foregrounded, only the in-app toast fires.
5. Deleting a notification removes it from the list immediately and shows a confirmation toast ("Notification deleted").
6. Marking a single notification read updates its styling immediately (loses the unread highlight) and decrements the badge by exactly 1.
7. "Mark all read" button (header) performs the same bulk action as auto-mark-on-open and shows a success toast.
8. A Supabase error on any of load/mark/delete logs to console and leaves the previous UI state intact (no partial/inconsistent state).

### Risk-based edge cases
- [High] `loadNotifications`'s query (`supabase.from('notifications').select('*').order(...).limit(50)`) has **no `.eq('user_id', user.id)` filter** in the visible code — it relies entirely on RLS to scope rows to the current user. If RLS on the `notifications` table is ever misconfigured, this component would happily render another user's notifications. This is the single highest-risk item in this file; worth an explicit RLS test pass independent of the UI.
- [Med] Auto-mark-all-on-open runs `markAllAsRead()` (a full `user_id`-scoped bulk `UPDATE`) but the effect's dependency array is only `[isOpen]` — its own inline comment disables the exhaustive-deps lint rule. If a realtime notification arrives at the exact moment the sheet is open (already satisfied `isOpen === true`), `unreadCount` changes but the effect does not re-fire (since `isOpen` didn't change), so that just-arrived notification is **not** immediately marked read by the "open" trigger, and remains visibly unread in an already-open panel until the user manually marks it or reopens the sheet.
- [Med] `deleteNotification` does not adjust `unreadCount` if the deleted item was unread — deleting an unread notification leaves the badge overcounted (shows a number with no corresponding visible unread row), until the next `loadNotifications()`/mark-all-read reconciles it.
- [Med] `formatDistanceToNow` will throw/format oddly if `created_at` is ever null/malformed (no guard before `new Date(notification.created_at)`).
- [Low] "99+" cap is a display-only formatting difference from `Navigation`'s uncapped Friends badge — inconsistent conventions across the same nav bar.
- [Low] Toast text for realtime notifications is duplicated in two different hooks (`NotificationCenter`'s own `useRealtimeNotifications` callback, using `sonner`'s `toast()`, plus `useRealtimeNotifications` itself firing its own `useToast()`-based toast for the same DB row when consumed elsewhere) — worth checking for double-toast on a single event if both hook instances are mounted concurrently app-wide (`RealtimeNotificationListener` in `App.tsx` plus `NotificationCenter`'s own usage).

---

## Global Feature: ErrorBoundary.tsx
**Auth requirement:** n/a (wraps both authed and public routes; one instance wraps the whole `<App>`, and a fresh instance wraps each individual `<Route>` element)

### UI inventory
- Buttons: "Reload Application" (sets error state false then hard-navigates to `/`), "Go to Login" (hard-navigates to `/auth`, does not reset error state first — but since navigation unmounts the tree, this doesn't matter in practice)
- Inputs/forms: none
- Modals/dialogs: none — full-page fallback UI
- Distinct states: no-error (renders children) vs. errored (renders fallback, or a custom `fallback` prop if supplied by the caller — no caller in this codebase currently passes a custom `fallback`, confirmed by usage sites all being bare `<ErrorBoundary><Page /></ErrorBoundary>`)

### Workflows
1. Class component using `getDerivedStateFromError` to flip `hasError` + capture `error`, and `componentDidCatch` to `console.error` the error + React error info (no external error-reporting/Sentry-style call despite the fallback text's claim "We've been notified").
2. Because every route in `App.tsx` is individually wrapped (`<Route path="/analytics" element={<ErrorBoundary><Analytics/></ErrorBoundary>} />`) in addition to one global wrapper around the entire app, a render error thrown by one page is contained to that page's boundary — the persistent chrome mounted outside the `<Routes>` block in `App.tsx` (`BatterySaverBanner`, `PWALocationBanner`, `SmartStatusChip`, `SnapBottomNav`, `QuickActionsFAB`, `Toaster`/`Sonner`) is **not** wrapped by any of these per-route boundaries and would only be caught by the outermost app-level `ErrorBoundary`, which unmounts literally everything (nav, toasts, banners) if any of those global components throws.

### Acceptance criteria
1. A thrown render error inside any single routed page shows that page's own full-page fallback ("Something went wrong") rather than a blank white screen or the dev-tools error overlay (in production builds).
2. The fallback displays the raw `error.toString()` in a scrollable monospace block — should be verified this doesn't leak sensitive data in error messages (e.g., raw SQL, tokens) in a production build.
3. "Reload Application" navigates to `/` via a hard `window.location.href` reload, not an SPA transition (fully resets JS state/memory stores).
4. "Go to Login" navigates to `/auth` via a hard reload.
5. An error thrown by a component mounted outside `<Routes>` (e.g., `SnapBottomNav`) takes down the entire app to the top-level fallback (no nav/toast chrome survives), since only the single app-level boundary wraps those components.

### Risk-based edge cases
- [High] Fallback copy states "We've been notified and are working on it" but `componentDidCatch` only does `console.error` — there is no Sentry/analytics/error-reporting call visible anywhere in this file or its imports. This is a user-facing **false claim** unless error reporting is wired up transparently elsewhere (e.g. a global `window.onerror`/console-forwarding integration) — worth explicitly verifying with the team before user testing, since it affects support expectations.
- [Med] Global chrome (banners, bottom nav, FAB, toast hosts) sits outside all per-route boundaries — any runtime error in `SmartStatusChip`, `PresenceTracker`, `BatterySaverBanner`, etc. blanks the *entire* app (not just a section), including on pages where that chrome is incidental.
- [Low] `handleReset`'s `setState` before the hard redirect is dead code in practice (page instantly navigates away, discarding the component and its state) — harmless but confusing to a reader/tester trying to understand recovery behavior.
- [Low] No "Try again" (retry-in-place without full reload) option — every recovery path is a full page reload, which is heavier than necessary for transient errors (e.g., a flaky network fetch inside one card).

---

## Global Feature: EmergencyShareButton.tsx
**Auth requirement:** component-level only (requires a `userId` prop; not itself route-guarded — caller's responsibility). Not currently mounted anywhere in the app (no import sites found besides its own file) — appears to be a built-but-unwired component.

### UI inventory
- Buttons: "Emergency Share" (destructive, opens dialog), "Confirm Share" (destructive, disabled while `loading` or after `success`)
- Inputs/forms: none (no text input — just a confirm action)
- Modals/dialogs: a `Dialog` — **note the JSX renders `<DialogHeader>` and `<DialogContent>` as siblings**, not `DialogContent` wrapping `DialogHeader` (see risk)
- Distinct states: idle → loading ("Sharing...") → success ("Location shared!", auto-closes after 2s) or error ("Failed to share location" / "Location unavailable")

### Workflows
1. Click "Emergency Share" → opens dialog.
2. Click "Confirm Share" → if `userLocation` is null, sets a local error and stops (no DB call); otherwise inserts one row into `emergency_shares` (`user_id`, `latitude`, `longitude`, `shared_at`).
3. On success: shows inline success text, then closes the dialog automatically after 2000ms via `setTimeout`.
4. On DB error: shows inline error text; button stays enabled? No — `disabled={loading || success}` means after a failure (`success` still false, `loading` reset to false) the button is re-enabled for retry, which is correct.

### Acceptance criteria
1. Clicking "Emergency Share" opens a confirmation dialog explaining that live location will be shared with trusted contacts.
2. If device location is unavailable (`userLocation === null`), clicking "Confirm Share" shows "Location unavailable" and performs no network call.
3. On success, an `emergency_shares` row is inserted with the exact `[lat, lng]` passed in via props and a `shared_at` timestamp, the dialog shows "Location shared!", and auto-closes after ~2 seconds.
4. On a Supabase insert failure, "Failed to share location" is shown and the Confirm button remains clickable for retry (not permanently disabled).
5. The dialog can be dismissed manually (`onOpenChange`) before the 2-second auto-close fires without any residual open/close state bug on reopen.

### Risk-based edge cases
- [High] **Component is not mounted anywhere in the app** (no route/page imports it beyond its own definition file, based on a workspace-wide search). If "Emergency Share" is an expected user-facing safety feature, this is a functional gap that should be confirmed with product before QA spends time writing test cases against a feature no user can currently reach.
- [High] Structural JSX concern: `<Dialog>` contains `<DialogHeader>` and `<DialogContent>` as direct siblings rather than `DialogContent` being the single child of `Dialog` with `DialogHeader` nested inside it (the conventional shadcn/Radix composition). Depending on the underlying primitives' implementation this may render the header completely outside the dialog's portal/overlay (visually detached, or invisible, or breaking focus-trap/ESC-to-close behavior) — needs a manual render check, not just a code read.
- [Med] No confirmation of *who* the "trusted contacts" are before sharing — copy says "shared with trusted contacts" but the insert only writes `user_id`/`lat`/`lng`/`shared_at` with no recipient list, table, or notification fan-out visible in this component — unclear whether contacts are actually notified by any downstream trigger.
- [Med] `userLocation` and `userId` are required props with no null-check on `userId` (only `userLocation` is checked before insert) — if a caller ever renders this before auth resolves, `userId` could be `undefined`/empty and still attempt an insert.
- [Low] Auto-close `setTimeout` is not cleared on unmount — if the component unmounts within the 2s window (e.g. user navigates away right after confirming), `setOpen` fires on an unmounted component (React will warn in dev, harmless in production but a lint/console-noise risk).

---

## Global Feature: Theme Switching — ThemeContext.tsx + ThemeToggle.tsx
**Auth requirement:** n/a, applies globally regardless of auth state

### UI inventory
- Buttons: single sun/moon icon toggle button (`ThemeToggle`), desktop-nav-only (see risk — not present anywhere in the mobile nav menu)
- Inputs/forms: none
- Modals/dialogs: none
- Distinct states: `light` / `dark` only (no "system"/auto-follow-OS persistent mode — OS preference is used only as the *initial* default when no explicit choice was ever saved)

### Workflows
1. `getInitialTheme()` runs synchronously during `useState` initialization (avoids flash-of-wrong-theme): reads `localStorage['theme']` if it's exactly `'light'` or `'dark'`; else checks `matchMedia('(prefers-color-scheme: light)')` and returns `'light'` if that matches; else defaults to `'dark'`. (Note: only *light* OS-preference is explicitly checked — dark-OS-preference and "no preference" both fall through to the same hardcoded `'dark'` default, which is coincidentally correct for dark-preferring OSes but is not derived from an explicit dark-preference check.)
2. On every `theme` change: toggles the `light`/`dark` class on `document.documentElement` and persists to `localStorage['theme']`, both wrapped in try/catch for environments without `localStorage` (e.g. private browsing).
3. `useTheme()` throws if called outside `ThemeProvider` — `ThemeProvider` wraps the entire `App` above `AuthProvider`, so this should never fire in practice within this app's own tree.

### Acceptance criteria
1. First-ever visit (no localStorage key) with OS set to light mode renders light theme; OS set to dark (or no OS preference signal) renders dark theme.
2. Toggling the theme immediately flips the `light`/`dark` class on `<html>` and persists the choice to `localStorage['theme']`.
3. Reloading the page (or opening a new tab) after toggling shows the previously chosen theme with no flash of the other theme on initial paint.
4. Theme choice is applied consistently across every route (global provider, not per-page).
5. In an environment where `localStorage` throws (private browsing / storage disabled), the app still renders with a theme (in-memory default) and does not crash.

### Risk-based edge cases
- [Med] **No theme toggle is reachable from the mobile nav at all.** `ThemeToggle` is rendered only inside `Navigation`'s `hidden lg:flex` desktop block; the mobile menu's expanded link list (which does include Settings, Profile, Analytics, Premium, etc.) has no theme entry. Unless theme switching exists elsewhere (e.g. inside the `/settings` page itself, out of this slice's scope), mobile users may have no in-app way to change theme at all — worth cross-checking against `Settings.tsx` before filing, but from this component alone it's a real gap.
- [Low] "System/auto" theme mode doesn't exist as a persistent option — once a user manually toggles, the app never again follows OS-level theme changes (e.g. OS auto dark-mode-at-sunset) even if the user never explicitly chose that OS-independent behavior; only the very first, storage-less visit reads OS preference.
- [Low] `matchMedia('(prefers-color-scheme: light)')` is checked but not its dark counterpart — an OS with an *explicit* dark preference and a browser/OS combination where `prefers-color-scheme: light` reports `false` due to some edge-case media-query quirk would silently fall to the hardcoded dark default anyway (same outcome, but the logic reads as accidental rather than intentional dark-preference handling).

---

## Global Feature: PWA Install Banner/Prompt Flow — usePWA.ts + PWALocationBanner.tsx (+ Install.tsx above)
**Auth requirement:** n/a, browser/device-capability driven

### UI inventory
- `usePWA()` itself renders no UI directly — it drives `Install.tsx`'s branching (above) and pushes items into the app's in-app notification store (`useAppStore.addNotification`) for events: install-available, installed, back-online, offline. These are **store-only** notifications — it's not confirmed from this hook alone that they surface as a visible toast/banner without checking how `useAppStore`'s notifications are consumed elsewhere (out of this slice's direct scope, but worth flagging as an integration point).
- `PWALocationBanner` (a separate, unrelated-but-similarly-named "PWA banner"): a dismissible informational banner shown only when running as an installed PWA (`display-mode: standalone`), explaining OS background-location limits. Dismiss state persists via `localStorage['pwa-location-banner-dismissed']`.
- Distinct states (usePWA): not-installable/not-installed (default) → installable (`beforeinstallprompt` captured) → installed (`appinstalled` fired or already standalone) × online/offline.
- Distinct states (PWALocationBanner): defaults to `dismissed = true` until an effect confirms PWA mode and checks localStorage (prevents a flash of the banner in browser-tab mode); shown only when `isPWA && !dismissed`.

### Workflows
1. `usePWA` listens for `beforeinstallprompt` (captures + prevents default browser mini-infobar, flips `isInstallable`) and `appinstalled` (flips `isInstalled`, clears `isInstallable`/prompt).
2. Also unconditionally unregisters **any existing service worker** on every mount (`registrations.forEach(r => r.unregister())`) — explicitly commented "disabled for better deployment compatibility." This means **offline support and any previously-registered SW-based caching are actively torn down** every time the app loads, directly contradicting the "Works offline" bullet point shown in `Install.tsx`'s own UI copy (both the "Already Installed" and "Install App" cards claim offline support).
3. `getAppVersion()` posts a message to `navigator.serviceWorker.controller` and awaits a reply — given SWs are unregistered on every mount, this will simply hang/never resolve `'1.0.0'` unless a controller happens to already exist from a not-yet-unregistered prior SW in the same page lifecycle (race-prone).
4. `PWALocationBanner` independently reads `isPWA` from `useLocation()` (a different hook than `usePWA`) and gates its own dismiss/show logic purely off `localStorage`.

### Acceptance criteria
1. On a supporting browser, `beforeinstallprompt` firing flips app-wide install-availability state used by `Install.tsx` (see that section).
2. `appinstalled` firing (or already-standalone detection) flips to "installed" state consistently.
3. Going offline/online fires the corresponding in-app notifications via `useAppStore`.
4. `PWALocationBanner` appears only when running as an installed PWA and only if not previously dismissed on this device/browser profile; dismissing persists across reloads.
5. No service worker remains registered after app load (per current intentional design) — offline functionality should **not** be advertised anywhere in the UI while this is true.

### Risk-based edge cases
- [High] **Direct contradiction between code and UI copy**: `usePWA` unconditionally unregisters all service workers on every mount ("disabled for better deployment compatibility"), yet `Install.tsx` explicitly advertises "Works offline" as a benefit/feature in both the "Already Installed" and "Install App" cards. Any tester who installs the PWA and then tests offline behavior (e.g., airplane mode) per the app's own stated feature will find it does not work, since there is no active service worker to serve cached content. This is the most concrete false-advertising / broken-acceptance-criteria bug found in this slice and should be a top-priority ticket.
- [Med] `getAppVersion()` can hang indefinitely (never resolves) in the common case where no SW controller exists, since it relies on a `postMessage`/`MessageChannel` round-trip to a service worker that this same hook makes sure never stays registered — if anything in the app awaits this without a timeout, it's a latent hang risk.
- [Med] `usePWA`'s online/offline and install-flow notifications go into `useAppStore` (a separate app-wide store) rather than the Supabase-backed `notifications` table used by `NotificationCenter` — these two "notification" concepts are entirely separate systems, so testers should not expect PWA/connectivity events to show up in the bell icon's panel, only wherever `useAppStore`'s notifications are separately rendered (if anywhere) — worth explicit clarification/QA note since the naming overlap invites confusion.
- [Low] `PWALocationBanner`'s dismiss state is per-device/per-browser-profile (`localStorage`) with no per-account sync — reinstalling the PWA or clearing site data resets it to "not dismissed," which may be intentional but should be confirmed.

---

## Global Feature: Toast / Notification Systems (dual implementations)
**Auth requirement:** n/a

### UI inventory
- Two independently mounted toast hosts in `App.tsx`: shadcn/Radix `<Toaster />` (backed by `src/hooks/use-toast.ts`) and `<Sonner />` (the `sonner` library, invoked directly as `toast(...)`/`toast.success(...)` in files like `NotificationCenter.tsx`).
- `use-toast.ts` internals: `TOAST_LIMIT = 1` (only one Radix toast can be visually queued/shown at a time — a second `toast()` call while one is open replaces it in the visible slice), `TOAST_REMOVE_DELAY = 1000000` ms (~16.7 minutes) before a dismissed toast is actually purged from memory state (dismiss just sets `open: false` for exit animation; full removal is deliberately delayed, presumably to allow exit transitions, but is unusually long).
- Both systems are used interchangeably across the app depending on which hook a given component imports (`useToast()` vs `sonner`'s `toast`), including within the **same feature area** (e.g. `NotificationCenter.tsx` uses `sonner`'s `toast` directly for its own actions like "Notification deleted"/"All notifications marked as read", while `useRealtimeNotifications.ts` — consumed by that same `NotificationCenter` — uses the Radix `useToast()` hook for the "new notification arrived" toast).

### Acceptance criteria
1. Only one Radix (`use-toast`) toast is visibly queued at a time; a second call while one is showing replaces/updates rather than stacking.
2. Sonner toasts (used for realtime notification arrivals in `NotificationCenter`, and for `NotificationCenter`'s own read/delete confirmations) can appear independently of, and simultaneously with, Radix toasts, since they are two separate rendering trees/hosts.
3. Both toast systems are visually distinguishable enough (or intentionally similar) that testers don't perceive simultaneous different-styled toasts as a bug — needs explicit design confirmation.

### Risk-based edge cases
- [Med] Running two toast libraries simultaneously (Radix `Toaster` + `sonner`) is itself a maintainability/consistency risk: a single user action flow can end up producing toasts with two different visual styles/positions/animations depending on which component fired it (e.g., receiving a new notification uses the Radix-styled toast via `useRealtimeNotifications`, but marking-all-read on the same panel uses a `sonner`-styled toast) — likely to read as a visual inconsistency bug during exploratory testing even though both are "working as coded."
- [Low] `TOAST_LIMIT = 1` for the Radix system means rapid-fire sequential events that each trigger a toast (e.g., several notifications in quick succession, if any ever route through the Radix `useToast` path) will only ever show the most recent one — earlier ones are effectively dropped from view, not queued.
- [Low] The ~16.7-minute `TOAST_REMOVE_DELAY` before full removal from memory state is unusually long; unlikely to cause a *visible* bug (dismissed toasts are already `open:false`), but is worth a sanity check that this isn't an accidental typo for a much shorter intended delay (e.g. `1000` ms).

---

## Global Feature: i18n / Language Switching — src/i18n/index.ts
**Auth requirement:** n/a

### UI inventory
- No user-facing language switcher UI exists anywhere in the codebase (no `LanguageSwitcher`-style component found in a workspace-wide search).
- `i18next` is initialized (imported once, in `src/main.tsx`) with `LanguageDetector` (order: `localStorage` → `navigator` → `htmlTag`) and exactly **one** locale bundle, `en`, containing a small, partial set of keys (`nav.*`, `common.*`, `auth.*` — roughly two dozen strings total).

### Workflows
1. On app boot, `i18next` auto-detects a "preferred" language from localStorage/browser/`<html lang>`, but since only `en` resources exist and `fallbackLng: 'en'`, every detected language other than English silently falls back to the same English strings.
2. No component in the audited slice (or found via search) actually calls `useTranslation()`/`t()` against these specific keys in visible UI text — the vast majority of user-facing strings across the app (including every page/component in this inventory) are hardcoded English literals, not routed through `i18next` at all.

### Acceptance criteria
1. App boots successfully regardless of the detected browser/OS language (no crash from missing translation resources), always rendering English text.
2. There is currently no way for a user to change the app's display language from within the UI (no acceptance criteria beyond "this is expected/known" unless a switcher is added).

### Risk-based edge cases
- [Med] i18n infrastructure is fully wired up (detector + init) but almost entirely unused in practice — this reads as an incomplete/abandoned feature rather than "intentionally English-only," and could mislead a tester who finds `i18n/index.ts` into writing test cases for a multi-language experience that doesn't exist anywhere in the UI. Worth a product clarification: is multi-language support planned/in-progress, or is this dead scaffolding that should be removed?
- [Low] The translation dictionary itself is inconsistent with actual nav copy — e.g. `nav.home` → `'Home'`, but the real `Navigation.tsx` never renders that string (its Dashboard link is labeled "🏠 Dash", not "Home"); if this dictionary were ever wired up, several keys would immediately be stale/mismatched against current UI copy.

---

## Global Feature: OnboardingTour.tsx
**Auth requirement:** n/a (client-side `localStorage` gate only; not tied to actual logged-in state); currently mounted only in `Live.tsx` and `Maps.tsx` (i.e., not globally mounted in `App.tsx` despite being a good candidate for "app-wide" — worth noting it is not actually shown on every first-run route, only on those two pages)

### UI inventory
- Buttons: close (X, top-right — equivalent to Skip), "Previous" (hidden on step 0), "Next"/"Get Started" (final step), "Skip Tour" (hidden on the final step)
- Modals/dialogs: full-screen overlay card (not a Radix `Dialog` — a plain `motion.div` overlay), not focus-trapped or `Escape`-dismissible via any visible keyboard handler
- Distinct states: 6 fixed steps (Welcome → Bubbles → Stories → Live Locations → Connect & Chat → All Set), each with a progress bar (`(step+1)/6 * 100%`) and step-dot indicators

### Workflows
1. On mount (wherever included — `Live.tsx`/`Maps.tsx`), checks `localStorage['hasSeenOnboarding']`; if unset, opens the tour after a 1-second delay.
2. "Next" advances `currentStep`; on the last step it instead calls `completeOnboarding()` (sets the localStorage flag, closes).
3. "Skip Tour" / close (X) both call `completeOnboarding()` immediately regardless of current step, so skipping short-circuits to "seen" the same as finishing.
4. `target` field on some steps (`'bubbles'`, `'stories'`, `'live'`, `'messages'`) is defined in data but never read/used anywhere in the render — no actual highlighting/scroll-to/spotlighting of the referenced UI element occurs; it's a purely descriptive/step-content modal with no page-anchoring behavior.

### Acceptance criteria
1. A first-time visitor to `Live.tsx` or `Maps.tsx` (no `hasSeenOnboarding` in localStorage) sees the tour open automatically ~1 second after mount.
2. Once shown to completion or skipped, `hasSeenOnboarding` is set in localStorage and the tour never auto-opens again on subsequent visits to either page (or app reloads), until localStorage is cleared.
3. Progress bar and step dots accurately reflect `(currentStep+1)/6`.
4. "Previous" is unavailable on step 1 (index 0); "Skip Tour" is unavailable on the final step (only "Get Started" remains).
5. Since the flag is shared (`hasSeenOnboarding`, not per-page), completing/skipping the tour on `Live.tsx` also suppresses it from ever auto-showing on `Maps.tsx` (and vice versa) — both mount sites gate off the exact same key.

### Risk-based edge cases
- [Med] Mounted independently on two separate pages (`Live.tsx`, `Maps.tsx`) with no shared "already open" guard between them — if both components were ever rendered in the same tree/route simultaneously (unlikely given routing, but notable if either page nests the other's content), two independent tour instances could both fire their own 1-second timers and both check/set the same localStorage key, risking a double-mount flash.
- [Med] The `target` field on step data (`'bubbles'`/`'stories'`/`'live'`/`'messages'`) is defined but completely inert — no spotlight/scroll/navigation happens; if design intent was an interactive product-tour (highlighting real UI), the current implementation is just a static slideshow modal, a gap worth flagging against original intent.
- [Low] No `Escape`-to-close keyboard handler and no focus trap — accessibility gap for a full-screen modal-like overlay (uses a plain `motion.div`, not a Radix `Dialog`, so none of the built-in a11y affordances apply).
- [Low] `hasSeenOnboarding` has no per-account persistence (pure localStorage) — a user who onboards on one device/browser, then logs into the same account on a different device/browser, sees the full tour again; likely intended, but worth confirming against product expectations (e.g. should it be stored against the profile instead?).

---

## Global Feature: Battery Saver Banner — BatterySaverBanner.tsx + useBatterySaver.ts
**Auth requirement:** n/a

### UI inventory
- No buttons/inputs — a passive, fixed, non-dismissible informational banner (`role="status"`, `aria-live="polite"`)
- Two mutually exclusive message variants: "App in background — GPS reduced to every 2 min" (when `backgrounded`) vs. "Battery Saver Active (N%) — GPS reduced to every 60s" (when low battery and foregrounded) — note `backgrounded` is checked first in the render branch, so if both conditions are true simultaneously (tab hidden **and** battery low), only the "backgrounded" message shows, never the battery percentage.
- Renders nothing (`null`) when `saverActive` is false.

### Workflows
1. `useBatterySaver` attempts the (non-standard, Chromium-only) `navigator.getBattery()` API; if unsupported, `level`/`charging` simply stay at their initial `null`/`false` and only the `document.hidden`-driven `backgrounded` signal can ever trigger the banner on non-Chromium browsers (Firefox, Safari, iOS — i.e., **most of mobile Safari/iOS traffic will never see the actual low-battery message**, only the backgrounded one).
2. `saverActive = lowBattery || backgrounded` where `lowBattery = level !== null && level < 0.2 && !charging`.
3. Recommended polling intervals (`pollIntervalMs`/`maximumAgeMs`) are computed and returned by the hook for consumers elsewhere in the app to actually throttle GPS polling — this component itself only displays the banner; it does not verify that GPS polling elsewhere actually obeys these values (out of scope of this file, but a natural integration-test target: does the map/location-sharing code actually read and apply `pollIntervalMs`?).

### Acceptance criteria
1. On a device/browser exposing the Battery Status API, dropping below 20% battery while unplugged (and tab visible) shows "Battery Saver Active (N%) — GPS reduced to every 60s" with the correct rounded percentage.
2. Backgrounding the tab (switching apps/tabs) shows "App in background — GPS reduced to every 2 min" regardless of battery level.
3. Charging while below 20% does **not** trigger the low-battery banner (since `!charging` is required for `lowBattery`).
4. On a browser without Battery API support (Firefox, Safari/iOS), the banner never shows a battery-based message — only the backgrounded message is reachable.
5. Banner disappears immediately when neither condition holds (foregrounded and battery ≥20% or charging, or Battery API unavailable and tab visible).
6. Simultaneous "backgrounded AND low battery" shows only the backgrounded message (defined, intentional-looking precedence in the JSX) — should be confirmed as intended UX rather than an accidental information loss (a user might want to know battery is also low when they return to the foreground).

### Risk-based edge cases
- [High] The Battery Status API (`navigator.getBattery`) is Chromium-only and has been removed/never shipped in Firefox and Safari (including iOS Safari, which also backs iOS PWAs) for privacy-fingerprinting reasons. On a large share of mobile traffic (iOS Safari/PWA, Firefox desktop/mobile), `level` stays `null` forever, so the entire "low battery" half of this feature is silently inert — only the tab-visibility-based "backgrounded" banner can ever appear. This should be treated as a known platform-coverage gap, not tested as if it should work everywhere.
- [Med] Banner is `fixed top-16` with no stated z-index conflict check against `PWALocationBanner` (`fixed top-[72px]`, `z-[999]`) — both are app-wide, always-mountable, top-anchored fixed banners; if both conditions (PWA + not dismissed, and battery-saver-active) are true simultaneously, verify they don't visually overlap/collide (BatterySaverBanner is `top-16`/`z-50`, PWALocationBanner is `top-[72px]`/`z-[999]` — close but not obviously identical offsets; worth a real-browser visual check, especially on narrow viewports where content could still clip).
- [Low] No manual override/dismiss — a user who intentionally wants full-speed GPS despite low battery (e.g., actively navigating) has no way to dismiss/opt out of the reduced polling from this banner; whether that control exists elsewhere (Settings) is outside this file's scope.
- [Low] Percentage shown is `Math.round(level*100)`, recomputed only on `levelchange`/`chargingchange` events (no polling) — on devices/browsers that fire these events infrequently, the displayed percentage could be stale relative to the OS's own battery indicator.

---

## Global Feature: Referral / Invite Code — useReferralStore.ts (+ App.tsx capture flow)
**Auth requirement:** store/read/write actions require a userId; referral-code capture itself is anonymous (works pre-login)

### UI inventory
- No page in this slice renders referral UI directly; `InviteFriendsCard.tsx` (outside this slice) is the only consumer found of `useReferralStore`. Included here because `App.tsx`'s `capturePendingReferral()` (a genuinely global, route-independent piece of app bootstrap logic) is directly in scope as "app-wide."
- `App.tsx` on every app boot: reads `?ref=CODE` from the URL and, if present and no `pending_referral_code` is already stored, saves it to `localStorage['pending_referral_code']` for later redemption (per its own comment) during `ProfileSetup`.

### Workflows
1. Visitor arrives at any URL with `?ref=CODE` (e.g. shared referral link landing on `/`) → `capturePendingReferral()` runs once on `App` mount → stashes the code in localStorage if none is already pending.
2. Presumably redeemed later during `ProfileSetup` (outside this slice) by reading `pending_referral_code` — this inventory cannot confirm that redemption path actually consumes/clears the key, since `ProfileSetup.tsx` is outside the assigned slice; flagging as an integration point QA should trace end-to-end.
3. `useReferralStore.getOrCreateCode` retries up to 5 times on a uniqueness collision when generating a new persistent code for a user's profile; throws after 5 failed attempts.

### Acceptance criteria
1. Visiting any URL with `?ref=ABC123` stores `ABC123` under `localStorage['pending_referral_code']` exactly once (first visit); a second visit with a different `?ref=XYZ` while a code is already pending does **not** overwrite the first-captured code (per the `!localStorage.getItem(...)` guard).
2. Visiting with no `?ref=` param at all leaves any previously-stashed pending code untouched.
3. `getOrCreateCode` returns an existing `profiles.referral_code` if one already exists, without generating a new one.
4. `getOrCreateCode` throws a clear error after 5 collision retries rather than silently returning an invalid/undefined code.

### Risk-based edge cases
- [Med] The "first pending code wins, never overwritten" rule means a user who clicks referral link A, doesn't sign up, later clicks referral link B (different referrer) and signs up, is still attributed to referrer A — correct per the code's explicit intent, but worth confirming this is the desired business rule (vs. "last link clicked wins") since it's an easy point of confusion/dispute between two referring users.
- [Med] `pending_referral_code` is captured with no expiry — a link clicked months before eventual signup would still redeem, unless the (out-of-slice) redemption code enforces a freshness window. Worth a cross-slice test once `ProfileSetup.tsx` is in scope.
- [Low] `generateCode()` uses `Math.random().toString(36)` (6 chars, uppercased) — not cryptographically unique; the 5-retry collision handling in `getOrCreateCode` mitigates but doesn't eliminate a theoretical race between two concurrent signups generating the same code simultaneously (no DB-side uniqueness constraint confirmed from this file alone).
