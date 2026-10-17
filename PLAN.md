# ChangeOS: Vision

> "The Linux of Android." Fast, private, and you're in full control.

## Pillars
- **Super fast and super light.** Nothing preinstalled that you didn't ask for.
- **Super customizable**, at least as much as iOS. Colors can go as loud and bright as you want.
- **Privacy first.** No Google services.
- **Full control.** A real terminal for the OS is built in. This is intentionally powerful and dangerous.

## Default look
- Clean white and light gray, monochrome icons, big date and calendar widget (like the 4th phone in the reference image).
- A soft gray ("Fog") wallpaper by default, with near-white cards on it. Pure white felt too bright in the preview.
- Built-in themes: Fog (default), Graphite (dark), Loud (the accent color as the wallpaper). Users can push the colors as far as they want.

## Preinstalled apps (only two)
1. **Aurora Store**, an anonymous Play Store client
2. **Firefox**

Everything else comes from Aurora Store.

## Google policy
- Google apps like YouTube and Drive are allowed (users install them through Aurora).
- **The Google Play Store is banned.** `com.android.vending` can never be installed.

## SystemUI (redesign)
- New status icon: **battery, signal and wifi combined into one glyph**
  - Battery: a ring arc. Black is charge, gray is empty, and the tip turns red when low.
  - Signal: dots instead of bars.
  - Wifi: a small bullseye sitting in the ring's gap (upper right), centered exactly on the ring line.
    It's a solid disc in the foreground color with a cut-out center:
    - Cut-out dot (background color): connected
    - Gray center: connected, no internet
    - Thin hollow ring: no wifi
    - Half cut-out: hotspot or mobile data
  - The icon is drawn in the foreground color, so it works on light and dark themes.
- Quick settings and volume: designs still being explored.

## Lockscreen (draft)
- Layouts: Stack (huge stacked time), Ring (the time inside a battery ring), Card (time plus a date and weather card).
- Unlock methods: PIN, Ring PIN (digits around a circle, and the center ring fills as you type), pattern, password.
- Privacy options: scrambled keypad (it reshuffles after every failed try), and an entry-feedback setting of dots, ring fill or hidden.

## Logo
- `Logo.svg` is the status icon itself: an open ring, four signal dots, and the bullseye in the gap. The logo and the status bar are the same mark.
- It's drawn in `currentColor` (default #111), so it can be recolored for any theme.
- The old raccoon logo is kept in `archive/Logo-raccoon.png`.

## Boot animation (draft)
- The ring draws itself in, spins while Android loads, then settles. The four dots pop in one by one, the bullseye drops into the gap, and the "ChangeOS" wordmark appears.
- It will be rendered from `Logo.svg` into `bootanimation.zip`.

## Open technical questions
- **SystemUI rewrite, Play Store ban and root terminal on a GSI-only base.** See the notes in chat (2026-10-16).
