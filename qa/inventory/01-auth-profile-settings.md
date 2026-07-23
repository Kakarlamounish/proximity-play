# QA Feature Inventory — Auth, Profile Setup, Dashboard, Settings, Profile

## Route: /auth — Auth
**Auth requirement:** public only. If `useAuth()` reports a logged-in user (`user && !loading`), the page immediately renders `<Navigate to="/" replace />` — note this lands on **Maps** (`src/pages/Maps.tsx`, the root route), not on `/dashboard`. While `loading` is true (initial Supabase session check, capped at 3s by a timeout in `AuthContext`), the page renders `<PageSkeleton />` instead of the form.

### UI inventory
- **Buttons:** "Sign In"/"Sign Up" tab toggle (switches `mode` state, no confirmation, does not clear typed fields); show/hide password eye icon toggle; primary submit button (label/icon changes with `mode`: "Sign In" vs "Create Account"); "Continue with Google" button; two non-interactive-looking `<span>` "Terms"/"Privacy Policy" links (styled as clickable but have **no click handler or href** — dead UI).
- **Inputs/forms:** Full Name (signup mode only, not marked `required`, not validated), Email (`type="email"`, no `required` attribute — browser still runs native format validation on submit because of the `type`), Password (`type` toggles between `password`/`text`; placeholder claims "Min 8 characters" in signup mode but **no client-side length check exists**).
- **Modals/dialogs:** none.
- **Distinct states:** initial auth-check loading (`PageSkeleton`), redirect-away (already authenticated), sign-in form, sign-up form, submitting (`isLoading` shared by both the email form and the Google button — clicking one disables both), toast-driven error state, toast-driven success state (signup only).
- **Workflows:**
  1. Sign up → success toast "Check your email to confirm" → `mode` auto-flips to `signin` (email/password values are retained in state) → user must confirm via emailed link → sign in.
  2. Sign in → `onAuthStateChange` fires in `AuthContext` → `user` becomes non-null → `Auth` redirects to `/` (Maps) → Maps independently queries `profiles` by id (`maybeSingle`) → if no row, redirects to `/profile-setup`.
  3. Google OAuth → `supabase.auth.signInWithOAuth({ redirectTo: origin + '/' })` → same profile-check-and-redirect logic runs on the Maps landing page.

### Acceptance criteria
1. Given an unauthenticated visitor, when they load `/auth`, then the sign-in form is shown by default (`mode` initial state is `'signin'`).
2. Given a logged-in user (session already present), when they navigate to `/auth`, then they are redirected to `/` without seeing the form.
3. Given empty email or password, when the user submits the email/password form, then a "Missing fields" destructive toast appears and no network call is made.
4. Given valid credentials in sign-in mode, when submitted, then `supabase.auth.signInWithPassword` is called and, on success, `AuthContext`'s listener updates `user`/`session` causing the page to redirect away.
5. Given sign-up mode with valid email/password, when submitted, then `supabase.auth.signUp` is called with `options.data.full_name`, a success toast is shown, and the UI switches to sign-in mode (it does **not** auto sign the user in).
6. Given the password visibility toggle is clicked, then the input's `type` flips between `password` and `text` without clearing the value.
7. Given the Google button is clicked, when `signInWithOAuth` errors, then a destructive toast shows `error.message` and `isLoading` resets to `false`.
8. Given any Supabase error (network failure, invalid credentials, rate limiting) during email/password auth, then the raw `error.message` is surfaced to the user via toast (not a sanitized/friendly message).

### Risk-based edge cases
- [High] Password field advertises "Min 8 characters" in the placeholder but there is no client-side enforcement — a 1-character password is submitted straight to Supabase; if the project's auth policy allows short passwords, weak passwords are silently accepted, and if it doesn't, the user sees a raw backend rejection message that doesn't match the UI's stated rule.
- [High] Signup has no email confirmation gate in the UI — if the Supabase project has "confirm email" disabled, the success toast telling users to "check your email" is simply wrong; if enabled, a user who immediately tries to sign in before confirming gets an opaque error.
- [Med] Full Name is not required and not validated (no length/character checks) — empty or whitespace-only names, or extremely long strings/emoji/script injection strings, are stored as-is via `options.data.full_name` and later surface as the display name in Profile Setup pre-fill and elsewhere.
- [Med] Rapid double-click on "Sign In"/"Create Account": `isLoading` is set via `setState` inside the synchronous click handler, so on a very fast double-click before React re-renders/disables the button, two concurrent auth requests can fire (duplicate signup attempts, duplicate sign-in network calls).
- [Med] Switching between Sign In / Sign Up tabs preserves email/password state — a password typed for signup is silently reused as the signin password attempt, which could confuse users comparing the two flows.
- [Med] Network failure (offline, Supabase down) during `signInWithPassword`/`signUp`/OAuth: caught generically, shows `'Authentication failed'`/message, but `isLoading` is always reset in a bare `setIsLoading(false)` after the try/catch — confirm this executes even when the browser is fully offline (fetch throws synchronously-caught error) so the UI doesn't get stuck disabled.
- [Med] Expired/stale session edge case: `AuthContext` has a 3-second timeout that forces `loading=false` even if `getSession()` hasn't resolved — on a slow network this could momentarily show the auth form to a user who is actually still logged in (flash of wrong state), or vice versa show stale "loading" UI.
- [Low] "Terms" and "Privacy Policy" text is styled as a clickable underlined link but has no `onClick`/`href` — clicking does nothing (dead link, but visually implies navigation).
- [Low] Mobile/touch: the password eye-icon toggle button sits close to the input's right edge (`right-3`) — verify tap target size (44px) isn't compromised on small screens, especially alongside the lock icon on the left.
- [Low] Google OAuth error branch (`catch` block) duplicates the same toast as the `if (error)` branch — verify only one toast fires, not both, when `signInWithOAuth` both returns an `error` object and also somehow throws.

---

## Route: /profile-setup — ProfileSetup
**Auth requirement:** logged-in (any authenticated user, regardless of whether a profile row already exists). Unauthenticated users (`!user && !loading`) are redirected to `/auth`. There is **no guard preventing an already-onboarded user from revisiting this page** and re-submitting (it will simply `upsert` over their existing profile).

### UI inventory
- **Buttons:** interest chips (20 preset options, toggle add/remove, `Button` `variant` flips between outline/filled), "Add" button for custom interest, final submit "Complete Profile" button.
- **Inputs/forms:** `ImageUpload` avatar picker (see below), First Name/Nickname (required, no max length), Age (`type="number"`, `min=15 max=120`, required), Gender select (optional, 4 options), Bio `Textarea` (optional, `maxLength=150`, live character counter), custom interest text input (`maxLength=20`).
- **Modals/dialogs:** none (single-page form).
- **Distinct states:** auth-loading spinner, unauthenticated redirect, pre-filled state (Google metadata auto-fills `firstName`/`profilePhotoUrl` on mount if empty), empty/untouched form, validation-blocked (submit disabled), submitting (`isLoading` spinner + "Creating profile..."), success (toast + `navigate('/')`), failure (destructive toast with raw error message).
- **Workflows:** Load page (optionally pre-filled from Google OAuth metadata: `full_name`/`name`/`given_name`, `avatar_url`/`picture`) → fill required fields → optionally pick interests (max 10) and upload/replace photo → submit → `profiles.upsert` → best-effort redeem of any `pending_referral_code` found in `localStorage` (referral errors are swallowed, `.catch(() => {})`) → success toast → `navigate('/')` (lands on Maps, which then re-checks the profile and, since it now exists, does not bounce back).

### Acceptance criteria
1. Given an unauthenticated visitor lands on `/profile-setup`, then they are redirected to `/auth`.
2. Given `age` is empty or the string doesn't parse to a positive number, then the submit button stays disabled (`disabled={... || !age || parseInt(age) < 15}`), preventing submission.
3. Given age input is between 1–14, when the user attempts to submit (e.g., via Enter key bypassing the disabled button state timing), then a "Age requirement" destructive toast blocks the `profiles.upsert` call.
4. Given the DB has `CHECK (age >= 15)` on `profiles.age`, then any client bypass that reaches the server with age < 15 is rejected at the database layer as a fallback.
5. Given 10 interests are already selected, then all unselected preset chips and the custom "Add" button become disabled, preventing an 11th interest.
6. Given the same interest is already selected, clicking its chip again removes it (chip acts as a toggle, not an "add only" control).
7. Given a valid submission, when `profiles.upsert` succeeds, then a success toast fires and the user is navigated to `/`.
8. Given `localStorage` contains `pending_referral_code` (set via `?ref=CODE` query param captured by `App.tsx` on any page load), then after profile creation the code is consumed (`localStorage.removeItem`) and `redeem-referral` is invoked exactly once, regardless of whether the referral call succeeds or fails.
9. Given the bio field, then character count is capped client-side at 150 (`maxLength`) and the live counter (`{bio.length}/150`) matches the actual textarea content.

### Risk-based edge cases
- [High] Age boundary/type-coercion: `age` is a string state bound to a number input; `parseInt(age)` on a non-numeric or empty string yields `NaN`, and `NaN < 15` is `false` in the disabled-button expression's second operand alone, but combined with `!age` (empty string is falsy) the button correctly stays disabled for empty input — verify decimal ages ("15.9"), negative ages ("-5"), and values with leading/trailing whitespace or scientific notation ("1e2") don't slip through `parseInt` truncation (e.g. "15.9" → 15, passes, submits age=15 silently truncating the entered value without telling the user).
- [High] Revisiting `/profile-setup` after onboarding is already complete silently overwrites the existing profile via `upsert` (no "you already have a profile" warning, no pre-fill from the existing row) — a user who bookmarks or is linked back to this URL can accidentally blank out `gender`/`bio`/`interests` fields they'd previously set, since the form only pre-fills from Google metadata, never from the existing `profiles` row.
- [Med] Referral redemption is fire-and-forget (`.catch(() => {})`) — an expired/invalid/already-used code fails silently with zero user feedback, so a referrer never learns their invite didn't count, and support has no client-visible error to go on.
- [Med] Network/backend failure on `profiles.upsert` (RLS denial, connection drop): caught generically, shows `error.message` (a raw Postgres/PostgREST message) as the toast description — not sanitized for end users.
- [Med] Photo upload failure inside `ImageUpload` (see below) leaves `profilePhotoUrl` at its previous value; the outer form has no visual indicator that the photo didn't actually save before the user proceeds to submit the rest of the profile.
- [Med] Custom interest input allows duplicate-looking entries that differ only by case/whitespace (e.g., "Chess" and "chess ") since the dedupe check (`!interests.includes(...)`) is a case-sensitive exact match — a user can end up with near-duplicate interest tags.
- [Low] Gender is optional and defaults to empty string, coerced to `null` on submit (`(gender || null)`) — confirm downstream features that read `profile.gender` handle `null` gracefully (not just the 4 enum values).
- [Low] Concurrent tab/double-submit: no `isLoading`-based race guard beyond disabling the button — if the network is slow, verify a user can't spam-click "Complete Profile" to fire multiple upserts (idempotent via `upsert`, but still wasted requests / possible interest-array flicker if responses race and one is stale).
- [Low] Mobile/touch: 20 interest chips plus a custom-interest row on a small screen — verify wrapping/scroll doesn't hide the submit button below the fold and that chip tap targets remain usable at `size="sm"`.

---

## Route: /dashboard — Index
**Auth requirement:** logged-in **and** must have a completed profile (a `profiles` row for that user). If authenticated but no profile row exists, `Index` itself performs the `profiles` lookup (`maybeSingle`) and calls `navigate('/profile-setup')` — this check is duplicated independently in `Maps.tsx` (the root `/` route), so the two implementations can drift out of sync over time.

### UI inventory
- **Buttons:** `SearchDialog` trigger, `AdvancedFilters` trigger, `CreateBubbleDialog` trigger, radius `Select` (500m/1km/2km/5km), refresh button (calls `requestLocation()`, spins while `locationLoading`), per-`BubbleCard` join/leave/chat actions (rendered twice: once in "Nearby Bubbles" and duplicated in "Hot Right Now" trending section for the same bubble if it qualifies for both — join/leave state is updated independently in each list's local state, see risk below), "Enable Location" empty-state action button (only shown when `locationError` is set).
- **Inputs/forms:** none directly (filters live in `AdvancedFilters` dialog, not read here in depth).
- **Modals/dialogs:** `SearchDialog`, `AdvancedFilters`, `CreateBubbleDialog` (all rendered as trigger buttons on this page; internals not traced here as they're shared components outside this page's core auth/profile scope).
- **Distinct states:** auth/profile loading (spinner, blocks entire page), unauthenticated redirect to `/auth`, profile-missing redirect to `/profile-setup`, location loading, location error (permission denied/unavailable/timeout — each surfaces a distinct browser-geolocation message), location unavailable (never requested / no coords yet), bubbles loading spinner, empty state (no bubbles found — copy differs based on whether the empty state is due to `locationError` or a genuinely empty radius), populated state (trending + nearby bubble grids), gamification stats (Level/XP/joined bubbles/stories/friends) computed live from three separate queries.
- **Workflows:** Land on dashboard → profile existence check → location permission request (browser geolocation prompt) → fetch all `bubbles` client-side, filter by Haversine distance + interest + member-count client-side, sort client-side → fetch caller's `bubble_memberships` to mark `is_member` → fetch a separately-queried "trending" list (top 10 by member_count, filtered again by `radius*2`) → user changes radius/filters → re-fetch triggered by `useEffect` dependency on `[latitude, longitude, filters, user]`.

### Acceptance criteria
1. Given a user without a `profiles` row loads `/dashboard`, then they are redirected to `/profile-setup` before any bubble data loads.
2. Given geolocation permission is denied, then `locationError` is set to "Location access denied by user", the Location Status card shows this message, and the bubble grid renders the "Location Access Required" empty state with an "Enable Location" button that re-triggers `requestLocation()`.
3. Given valid coordinates and no bubbles within the selected radius, then the "No Bubbles Nearby" empty state is shown (distinct copy/icon from the permission-denied case).
4. Given the radius `Select` is changed, then both `filters.radius` and the trending-bubbles distance cutoff (`radius*2`) are recalculated and the bubble lists re-fetch.
5. Given a bubble appears in both "Hot Right Now" (trending, top 3) and "Nearby Bubbles", when the user joins it from one card, then only that card's local state updates immediately — the other list's copy of the same bubble is not updated until the next full re-fetch (see risk below).
6. Given `userStats` computation: `level = floor(totalXP/100)+1` and `xp = totalXP % 100`, where `totalXP = stories*10 + reactions*2 + friends*5` — verify the progress bar width (`xp/100 * 100`) never exceeds 100% and level never shows 0.
7. Given the refresh button is clicked, then it is disabled while `locationLoading` is true and shows a spinning icon.
8. Given `bubbles` array changes (join/leave), then "Active Bubbles" and "Joined Bubbles" counts (both derived via `.filter(b => b.is_member).length`) update in sync with the grid.

### Risk-based edge cases
- [High] Trending and Nearby bubble lists are fetched and filtered independently and each maintains its **own** local `is_member`/`member_count` copy — joining/leaving a bubble that's shown in both lists updates only the list the user clicked from, leaving the other list showing stale membership/member-count until the next full effect re-run (e.g., changing the radius or reloading). This is a real state-desync bug a tester should reproduce.
- [High] All bubbles are fetched with `select('*')` (no server-side geo filtering) and distance-filtered entirely client-side via a Haversine calculation — with a large `bubbles` table this doesn't scale and also means a user briefly downloads bubble data (name, coordinates, description) for bubbles far outside their radius, including possibly private (`is_private`) bubbles, before filtering — verify RLS actually restricts what's returned rather than relying on client-side filtering for privacy.
- [Med] Geolocation error branches (`PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`) each produce a distinct message and also fire a **second** identical error via toast (`useLocation`'s own toast) in addition to the inline card message — verify this isn't a duplicate/annoying double-notification.
- [Med] Fetch failures (`bubbles`, `bubble_memberships`, stats queries) are only `console.error`'d, not surfaced to the user — a backend outage produces a silently empty or partially-stale dashboard with no error state, indistinguishable from "no bubbles nearby."
- [Med] `fetchUserStats` issues 3 sequential/parallel Supabase calls per load (stories count, story ids + reactions count, friendships) — verify behavior when a user has zero stories (avoids the extra reactions query entirely, per the `if (userStories && userStories.length > 0)` guard) vs. a very large story count (potential N+1-ish query cost via `.in('story_id', storyIds)`).
- [Med] Rapid radius changes (e.g., dragging through 500m → 1km → 2km quickly) fire overlapping async fetches; there's no request cancellation/abort or "latest wins" guard, so a slow earlier response could overwrite a faster later one (race condition), showing bubbles for the wrong radius.
- [Low] `member_count` is optimistically incremented/decremented client-side on join/leave (`b.member_count + 1` / `Math.max(0, b.member_count - 1)`) without confirming the server write succeeded — if the underlying join/leave mutation (inside `BubbleCard`, not traced here) fails, the displayed count can drift from the true DB value until next refresh.
- [Low] Mobile/touch: three quick-action buttons (Search/Filters/Create) plus radius selector and refresh icon are packed into the header — verify layout doesn't overflow/wrap awkwardly on narrow viewports.

---

## Route: /settings — Settings
**Auth requirement:** logged-in. Unauthenticated users are redirected to `/auth`. All sub-sections render behind a single `loading || profileLoading` gate (full-page spinner) — there is no per-card loading/error state.

### Sub-section: Appearance
Dark Mode `Switch`, backed by `ThemeContext` (`localStorage['theme']`, defaults to OS preference or `'dark'` if unavailable). Toggling is instant, no confirmation, purely client-side (no DB write).

### Sub-section: Notifications
Nine `Switch` toggles (Messages, Chat Sound, Unread Badges, Meetups, Bubble Suggestions, Calls, Friend Requests, Stories, Push, Email), all backed by a single `notifications` object persisted to `localStorage['notification-preferences']` via `updateNotifications`. Actually read back and enforced elsewhere via `src/utils/notificationPreferences.ts`'s `isNotificationCategoryEnabled(type)` / `TYPE_TO_CATEGORY` map (used by `useRealtimeNotifications`, per its own header comment — this is the fix referenced in the latest commit "implement notification preference schema and lookup utility to enforce user settings"). The Push toggle is special: it's gated by `usePushNotifications()` — `checked = notifications.push && pushSubscribed` (derived, not a raw preference flag), disabled entirely when `pushPermission === 'denied'`, and turning it on calls `subscribePush()` (browser permission prompt + service worker `PushManager.subscribe` + upsert into `push_subscriptions`) while turning it off calls `unsubscribePush()`.

### Sub-section: Privacy & Safety
Ghost Mode, Blur Exact Location, Trusted Friends Only — all three are **`localStorage`-only** toggles (`ghost-mode`, `blur-location`, `trusted-only` keys); none of them write to the `profiles` table or call any Supabase function from this page. "Share for Limited Time" (1h/4h/8h/24h buttons) starts a client-side `setTimeout` that, when it fires, force-enables Ghost Mode and shows a toast — this timer exists only in component/JS memory (see risks). "Profile Visibility" switch is present but `defaultChecked` (uncontrolled) with **no `onCheckedChange` handler at all** — it is fully decorative.

### Sub-section: Biometric / Security (`<BiometricAuth mode="register" />`)
Checks WebAuthn support (`window.PublicKeyCredential`) and `isUserVerifyingPlatformAuthenticatorAvailable()`. Loads existing `webauthn_credentials` rows regardless of `mode`. In `mode="register"` (the only mode used here), shows a "Register Biometric" button that calls two edge functions (`webauthn-register-options`, `webauthn-register-verify`) around `@simplewebauthn/browser`'s `startRegistration`, and lists registered devices with per-device "Remove" (hard delete from `webauthn_credentials`, no confirmation dialog). If the browser doesn't support WebAuthn, the whole card is replaced by an `Alert` saying so.

### Sub-section: Preferences
Language (`en`/`es`/`fr`/`de`) and Timezone (`UTC`/EST/PST/GMT) selects — both `localStorage`-only, no visible effect elsewhere in the traced code (i.e., changing "Language" does not appear to change any UI copy). Call timeout select (15/30/45/60s) — `localStorage['call-timeout-seconds']`, read back with a `Number.isFinite(n) && n > 0` guard on load.

### Sub-section: Blocked Users
Lists `user_blocks` rows joined against `profiles` for display name/photo; "Unblock" button deletes the row and updates local state; empty state text "No blocked users".

### Sub-section: Storage & Data (GDPR)
Storage-used readout (computed by listing the `profile-photos` storage bucket for the user's folder and summing `metadata.size`, converted to MB and rounded to 2 decimals — recomputed once on page load, not live). `UpdateLocationDialog` (manual lat/lng entry with validation: both fields required, must parse as numbers, lat in [-90,90], lng in [-180,180], or "Use Current Location" via browser geolocation). "Export All My Data (JSON)" — pulls profile, bubble memberships (with nested bubble rows), sent messages, up to 5000 location-history rows, trips, dead drops, in parallel, and downloads as a JSON file — labeled "GDPR compliant" but does not include other tables the user may appear in (e.g., messages *received*, badges, snap scores/streaks, blocked-user relationships). "Delete Location History & Activity" — opens a confirmation `AlertDialog`, then deletes `location_history`, `trips`, `dead_drops` rows for the user in parallel; does not touch messages, bubble memberships, or stories.

### Sub-section: Help & Support
Four `Button variant="ghost"` rows ("Privacy Policy", "Terms of Service", "Contact Support", "Report a Bug") — **none have `onClick` handlers**; all are dead buttons.

### Sub-section: Account Actions
"Sign Out" opens a confirmation `AlertDialog`; confirming calls `signOut()` from `AuthContext` (Supabase sign-out + `window.location.href = '/auth'` full page navigation). "Delete Account" opens a separate destructive confirmation `AlertDialog`; confirming (`executeDeleteAccount`) deletes only the `profiles` row for the user (relying on `ON DELETE CASCADE` foreign keys across many tables, confirmed in migrations) and then calls `signOut()` — **it does not delete the underlying Supabase Auth user** (no admin API / edge function call), so the login credentials remain valid indefinitely after "deletion" (see risk below).

### Acceptance criteria
1. Given an unauthenticated visitor loads `/settings`, then they are redirected to `/auth`.
2. Given Dark Mode is toggled, then `document.documentElement`'s class list updates immediately and the choice persists across reloads via `localStorage['theme']`.
3. Given any notification `Switch` is toggled, then `localStorage['notification-preferences']` is updated immediately and `isNotificationCategoryEnabled()` reflects the new value on the very next check (no page reload required, since it re-reads `localStorage` on each call).
4. Given push permission is `'denied'` at the OS/browser level, then the Push switch is rendered disabled and cannot be toggled on regardless of the stored preference.
5. Given the user enables Push notifications, when `subscribePush()` resolves falsy (permission denied or unsupported), then the preference is **not** persisted as enabled (toggle visually reverts).
6. Given "Share for Limited Time" is clicked (e.g., 1h), then the button row is replaced by a live "Sharing until HH:MM" indicator, and Ghost Mode toggle-start buttons are disabled while Ghost Mode is already on.
7. Given the timer set in (6) elapses (after `hours * 3600000` ms), then Ghost Mode is force-enabled and a toast announces it — **only if the Settings page/component instance is still mounted** (see risk).
8. Given "Delete Account" is confirmed, then the `profiles` row and its cascaded data are removed, a success toast fires, and the user is signed out and redirected to `/auth`.
9. Given "Delete Location History & Activity" is confirmed, then only `location_history`, `trips`, and `dead_drops` rows for that user are deleted; the account and profile remain fully intact and usable.
10. Given "Export All My Data" is clicked, then a `.json` file downloads containing profile, bubbles, sent messages, location history (capped at 5000 rows), trips, and dead drops, with an `exportDate` field.
11. Given a blocked user is unblocked, then the row disappears from the list immediately (no page refresh needed) and a confirmation toast appears.
12. Given WebAuthn is unsupported in the current browser, then the entire Biometric card is replaced by a single warning `Alert` and none of the register/remove functionality is reachable.

### Risk-based edge cases
- [High] "Delete Account" does not actually delete the Supabase Auth identity — only the `profiles` row. A user who deletes their account, then signs back in with the same email/password, will succeed at auth and be routed straight into `/profile-setup` as if they were new — this contradicts the dialog's copy ("permanent," "cannot be undone") and is a serious trust/compliance gap (GDPR "right to erasure" expectations vs. actual behavior) worth flagging before real users test this.
- [High] Ghost Mode / Blur Location / Trusted Only / Timed Share are **entirely `localStorage`-based** with no corresponding write to `profiles` or any privacy-enforcement table — these toggles almost certainly have zero effect on what the backend/RLS actually exposes to other users (nothing in this page persists them server-side), meaning the privacy promises in the UI copy ("Completely hide your location from everyone") may not be enforced at all server-side. This needs backend verification before relying on it for real user privacy.
- [High] The "Share for Limited Time" auto-ghost timer is a plain in-memory `setTimeout` — it does not survive a page reload, tab close, or navigating away and back (Settings component unmounts/remounts, losing `shareTimerActive`/`shareTimerEnd` state and cancelling the pending timeout). A user who starts a 24h timed share and closes the tab will never get auto-ghosted, directly undermining the feature's purpose.
- [High] The account-deletion cascade only covers tables with `profiles(id) ON DELETE CASCADE` foreign keys added across migrations — worth an explicit audit of whether *every* user-generated content table (chat messages, call logs, snap scores/streaks, webauthn credentials, push subscriptions) actually cascades, or whether some rows become orphaned (referencing a deleted profile id) after "deletion."
- [Med] Four Help & Support buttons (Privacy Policy, Terms of Service, Contact Support, Report a Bug) and the "Profile Visibility" switch are non-functional placeholders that look fully interactive — a real user clicking "Report a Bug" or "Contact Support" gets silent nothing, which is a bad first impression during user testing.
- [Med] Data export explicitly claims "GDPR compliant" / "all data stored about you" but omits several tables the user appears in (received messages, badges, snap scores/streaks, blocks, webauthn credentials, notification/push subscriptions) — the completeness claim in the toast/JSON (`gdprNote`) may not hold up to scrutiny.
- [Med] Storage-used figure is computed once per page load by listing a storage bucket folder — if that `list()` call fails (network/permission), it silently falls back to `0 MB` (`catch` sets `setStorageUsed(0)`), which reads as "no photos" rather than "couldn't determine."
- [Med] Push notification opt-out failure path: if `unsubscribePush()` throws/fails, the code still proceeds to persist `push: false` in preferences (`checked ? ... : await unsubscribePush()` result is not checked when `checked` is false) — the stored preference can say "off" while the actual browser subscription is still active server-side, so the user may keep receiving pushes they believe they disabled.
- [Med] Biometric "Remove" deletes a `webauthn_credentials` row with no confirmation dialog (unlike every other destructive action on this page, which uses `AlertDialog`) — inconsistent UX and a one-click accidental-removal risk, especially if it's the user's only registered authenticator.
- [Med] Language/Timezone selectors persist to `localStorage` but appear to have no observable effect anywhere else in the traced code — testers should confirm whether these are genuinely inert (dead feature) or wired up elsewhere not covered in this pass.
- [Low] `Call timeout` value is read from `localStorage` with a `Number.isFinite(n) && n > 0` guard, but a corrupted/hand-edited `localStorage` value that fails this check silently falls back to the hardcoded default (30s) with no user-visible indication that their setting was discarded.
- [Low] Concurrent tabs: toggling Ghost Mode (or any `localStorage`-only preference) in one tab does not sync to another open tab of the same app (no `storage` event listener), so two tabs can show contradictory toggle states until one is reloaded.
- [Low] Mobile/touch: this is a very long single-column settings page with ~10 stacked cards — verify sticky/scroll behavior and that destructive buttons (Delete Account, Delete Data) aren't accidentally reachable via momentum-scroll mis-taps near other content.

---

## Route: /profile — Profile
**Auth requirement:** logged-in. Unauthenticated users are redirected to `/auth`. No profile-existence redirect guard is present on this page itself (unlike `/dashboard`) — if a logged-in user with no `profiles` row somehow lands here directly, `profile` stays `null` and the page renders with empty/undefined fields (e.g., `profile?.first_name` → blank name, `profile?.created_at` → `formatDate(undefined)` → `"Invalid Date"`).

### UI inventory
- **Buttons:** `EditProfileDialog` trigger ("Edit Profile"), `UserBadges` and `InviteFriendsCard` internal controls (not traced in depth here — out of this page's core auth/profile scope), badge/interest chips are display-only (no click handlers on the Profile page itself).
- **Inputs/forms:** none directly on `Profile`; all editing happens inside `EditProfileDialog`.
- **Modals/dialogs:** `EditProfileDialog` — First Name (required), Age (`type="number"`, `min=13 max=120`, required — **note the mismatch with the DB `CHECK (age >= 15)` and with `ProfileSetup`'s own `min=15`**, see risk below), Gender select, Bio textarea (no `maxLength` here, unlike `ProfileSetup`'s 150-char cap), interests (Select-to-add + Badge-with-X-to-remove, no 10-item cap unlike `ProfileSetup`), a photo `ImageUpload`, and an "Import from Google" button that pulls `avatar_url`/`picture` from the current Supabase auth user's metadata (fails with a toast if the user isn't signed in with Google or has no such metadata).
- **Distinct states:** auth/profile loading spinner, unauthenticated redirect, populated profile (with or without bio/interests — both have "no X" fallback copy), zero-bubbles empty state ("You haven't joined any bubbles yet"), zero-badges empty state, snap-score/streak display (`useSnapScore`, `useSnapStreaks` — separate loading lifecycles not gated by the page's own `profileLoading`, so these can pop in after the rest of the page has rendered).
- **Workflows:** Load profile + bubble memberships (with nested bubble rows) + badges (with nested badge rows) in one `useEffect`, in parallel with independent `useSnapScore`/`useSnapStreaks` hook fetches → user opens Edit Profile → changes fields → submit → `profiles.upsert` → `onProfileUpdate` callback replaces the page's local `profile` state with the server's returned row (dialog closes) → optionally "Import from Google" to overwrite the photo without going through the file-upload flow.

### Acceptance criteria
1. Given an unauthenticated visitor loads `/profile`, then they are redirected to `/auth`.
2. Given a profile has no `bio`, then the quoted bio line is omitted entirely (not shown as empty quotes).
3. Given a profile has an empty `interests` array or `null`, then "No interests added" is shown instead of an empty badge row.
4. Given zero bubble memberships, then "You haven't joined any bubbles yet" is shown instead of an empty grid.
5. Given "Edit Profile" is opened, then the dialog pre-fills from the current `profile` prop (first name, bio, age defaulting to 18 if absent, gender, interests, photo) — not from a fresh server fetch.
6. Given the edit form is submitted successfully, then the dialog closes, a success toast appears, and the parent page's displayed name/age/bio/interests/photo update immediately without a full page reload.
7. Given "Import from Google" is clicked while signed in via email/password (no Google OAuth metadata), then a destructive "No Google photo found" toast appears and the photo field is left unchanged.
8. Given the age input in `EditProfileDialog` is set to 13 or 14 (allowed by the dialog's `min=13`), when submitted, then the request should either be rejected client-side or will fail at the database (`CHECK (age >= 15)`) — verify which actually happens and whether the resulting error message is comprehensible to the user (see risk).
9. Given Snap Score / Snap Streak data loads asynchronously and independently of `profileLoading`, then it should not block or delay the rest of the profile page's initial render.

### Risk-based edge cases
- [High] `EditProfileDialog`'s age input allows a minimum of **13**, while `ProfileSetup`'s initial-creation form enforces **15** client-side and the database enforces `CHECK (age >= 15)` — a returning user can type age 13 or 14, get no client-side error, submit, and receive a raw Postgres constraint-violation error message via toast (`error.message`) with no friendly explanation of what went wrong or why 13 was accepted by the form in the first place. This three-way mismatch (13 / 15 / 15) is a concrete, reproducible bug to log.
- [High] `Profile` page has no guard for a missing `profiles` row (unlike `/dashboard` and `/settings`, which both redirect to `/profile-setup` when absent) — a logged-in user without a profile who navigates here directly (e.g., a stale bookmark, or a race where they land here before the dashboard's redirect fires) sees a broken-looking page: blank name, `Age: undefined`, `formatDate(undefined)` producing "Invalid Date" next to "Joined".
- [Med] `EditProfileDialog`'s Bio field has no `maxLength`, unlike `ProfileSetup`'s 150-character cap on the same column — a user editing an existing profile can enter an arbitrarily long bio (only limited by whatever the `profiles.bio` column type allows server-side, not verified here), producing inconsistent length limits depending on which form was used.
- [Med] `EditProfileDialog`'s interests list has no 10-item cap (unlike `ProfileSetup`), so a user could accumulate more interests than were ever allowed at signup, which may break UI assumptions elsewhere (badge wrapping, filter dropdowns) that assume a small bounded set.
- [Med] "Import from Google" silently overwrites `profile_photo_url` in local dialog state without an upload/confirmation step or a way to preview before committing — if the Google metadata photo URL is stale/expired/points to a since-deleted Google account image, the profile photo could break with no fallback until the user notices and re-uploads manually.
- [Med] Badges are fetched twice in different ways: the page's own `useEffect` fetches `user_badges` joined to `badges` (used only to drive the `badges.length === 0` empty-state text) while the actual rendering is delegated to a separate `<UserBadges userId={user.id} />` component doing its own fetch — if the two diverge (e.g., RLS differences, caching), the empty-state text and the rendered badge list could disagree (empty-state message shown while `UserBadges` still renders badges, or vice versa).
- [Med] Network/backend failure fetching profile/bubbles/badges is only `console.error`'d — the page falls back to whatever partial state was set before the failure (e.g., `profile` stays `null`, bubbles/badges stay `[]`), rendering a "new user" looking empty profile for a user who actually has data, with zero visible error indicator.
- [Low] Concurrent edits: opening "Edit Profile" in two tabs and submitting from both will both succeed via `upsert` (last write wins) with no optimistic-concurrency check (no `updated_at` comparison) — the first tab's changes are silently discarded without any conflict warning.
- [Low] Mobile/touch: the profile header (avatar, name, bio, stats row, streak badges, Edit button) stacks a lot of content — verify the Edit Profile dialog (`max-w-2xl max-h-[90vh] overflow-y-auto`) scrolls correctly on small viewports without clipping the submit/cancel buttons.
- [Low] `isOverlay` prop exists on this component (renders without `<Navigation />` and with different container classes) suggesting it's reused inside another view (e.g., a modal/overlay elsewhere in the app) — worth confirming both render paths (`/profile` route vs. overlay usage) are exercised in testing, since a bug in the non-overlay-only styling could go unnoticed if only one path is tested.
