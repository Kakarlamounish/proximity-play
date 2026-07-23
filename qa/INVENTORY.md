# proximity-play — Master QA Feature Inventory

Full inventory of every route, role, button, input, modal, state, and workflow in the app, with documented acceptance criteria and risk-based edge cases per feature. Produced by reading the actual implementation (not just UI appearance) across `src/pages`, `src/components`, `src/hooks`, `src/contexts`, `src/stores`.

Companion documents:
- [`qa/BUGS.md`](./BUGS.md) — running bug log (currently 31 code-review findings tagged `NEEDS-LIVE-REPRO`, pending confirmation by driving the app)
- [`MOCK_BACKEND.md`](../MOCK_BACKEND.md) — how to run the app against the sanitized client-side mock backend (no real Supabase project touched)

## How to use this inventory

Each linked file below covers a group of routes/features with, per route: auth requirement, full UI inventory (buttons/inputs/modals/states/workflows), numbered testable acceptance criteria, and a finite risk-tagged (`[High]`/`[Med]`/`[Low]`) edge-case list. Use these as the test script for the real-user testing pass — work acceptance criteria first, then the edge cases in severity order.

## Route/feature groups

1. **[Auth, Profile & Settings](inventory/01-auth-profile-settings.md)** — `/auth`, `/profile-setup`, `/dashboard`, `/settings` (9 sub-sections), `/profile`
2. **[Map, Location & Discovery](inventory/02-map-location-discovery.md)** — `/` (Maps), `/discover`, `/live`, `/ar`, `/join/:inviteCode`
3. **[Social & Communications](inventory/03-social-comms.md)** — `/friends`, `/messages`, `/calls`, `/missed-calls`, `/camera`, `/stories`
4. **[Misc pages & global chrome](inventory/04-misc-global.md)** — `/analytics`, `/install`, `/leaderboard`, `/premium`, 404, plus app-wide: Navigation, NotificationCenter, ErrorBoundary, EmergencyShareButton, Theme switching, PWA install flow, dual toast systems, i18n, OnboardingTour, Battery Saver banner, Referral capture

## Coverage summary

| # | Routes | Auth-guard consistency | Notable systemic issues found |
|---|---|---|---|
| 1 | 5 routes, 9 Settings sub-sections | Consistent (redirect-to-`/auth` on all) | 3-way age-minimum mismatch (13/15/15); several "privacy" toggles are localStorage-only; account deletion doesn't remove the Auth identity |
| 2 | 5 routes | Inconsistent — `Discover.tsx` has no auth redirect | Client-side-only geo filtering leaks coordinates pre-filter on 2 routes; non-atomic invite-uses counter; `returnTo` never honored post-login |
| 3 | 6 routes | Inconsistent — `Friends.tsx` has no auth redirect, `Stories.tsx` is intentionally public | Disappearing messages are cosmetic; several dead/unwired controls (bubble live-chat, missed-call-back, in-page missed-call banner); real WebRTC race conditions in call accept/hangup |
| 4 | 4 routes + 11 global features | Mixed — one page (`Analytics.tsx`) has a **broken** guard (checks the wrong loading flag, not just "no guard") | Service worker unregistered every mount, contradicting "works offline" marketing copy; Premium/Stripe checkout is entirely non-functional (no persisted plan state anywhere); notification query has no explicit user-scoping filter (relies solely on RLS) |

## Cross-cutting themes to watch during live testing (not repeated per-route below)

- **Client-side privacy/geo filtering**: several features (Dashboard bubbles, Discover people/bubbles, Friends nearby-search) fetch broad row sets and filter by distance/ghost-mode in JS rather than server-side — worth a dedicated pass checking whether RLS actually restricts what's returned regardless of client filtering.
- **Two parallel "Ghost Mode" controls** (Settings = localStorage-only/inert, Maps = real `profiles.ghost_mode` write) — see BUG-003/BUG-008.
- **Dead/unwired UI**: Help & Support buttons, Terms/Privacy links, "Profile Visibility" switch, bubble live-chat, story-ring clicks, missed-call-back, in-page missed-call banner, weather widget, EmergencyShareButton (unmounted). None of these crash — they just silently do nothing, which reads worse in live testing than an error would.
- **Realtime channel proliferation**: most channels are named with embedded timestamps/random suffixes to dodge "already subscribed" errors rather than being reused/keyed cleanly — watch for orphaned-channel buildup during rapid navigation in manual testing.
- **Two independent toast systems** (Radix `useToast` + `sonner`) used interchangeably, sometimes within the same feature — expect visual inconsistency, not a functional bug, when both fire.
- **No user-blocking feature** despite a `user_blocks` table existing — flagged as a product gap affecting the harassment/safety edge cases across Friends/Messages/Calls.

## Status

Inventory pass: **complete** (21/21 routes + 11 global features covered). Next: live testing under the mock backend to confirm/refute the 31 `NEEDS-LIVE-REPRO` entries in `BUGS.md` and to discover bugs the code-review pass couldn't see (real timing/race behavior, actual rendering, cross-browser quirks).
