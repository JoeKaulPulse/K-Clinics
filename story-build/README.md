# K Clinics — website launch Story

A 1080×1920 vertical video announcing the new kclinics.co.uk, built in code so it
is reproducible and stays on-brand. It opens on the live website and is about the
site itself: the booking flow, the client portal, and the AI plan.

The piece uses the real product, not a mock. Every screen in the phone is captured
from the genuine site (live production, or the real `<BookingFlow>` component for
the booking steps). The logo is the supplied K-mark + CLINICS lockup, the type is
the site's own Fraunces / Geist / Geist Mono, and the palette is the brand palette
from `app/globals.css`. The music and the background clinic footage come from the
supplied promo video.

## Beats (~23.5s)

1. **Open** — full-bleed on the homepage hero ("Radiant skin, confident smiles."),
   which settles back into a phone.
2. **Booking** — the real booking flow: choose a treatment → option → date →
   a time → confirm ("Nothing charged until after your visit"), with a cursor
   tapping through it.
3. **Client portal** — the sign-in to "manage your appointments, payments and
   health forms".
4. **AI plan** — "Get your personalised treatment plan".
5. **Close** — logo lockup, kclinics.co.uk, Islington · London, Book online.

As a Story it splits into two cards (15s + 8.5s); it also works as a Reel.

## How it is built

| Stage | Tool | Output |
| --- | --- | --- |
| Capture site screens | Playwright + Chromium | `capture/*.png` |
| Booking-flow capture | local prod server + the real `<BookingFlow>` | `capture/flow-*.png`, `capture/taps.json` |
| Background plates + music | ffmpeg, from the promo video | `assets/bg-*.jpg`, `assets/music_bed.wav` |
| Compositor | `scene.html` + `scene.js`, driven frame-by-frame | `frames/*.png` |
| Encode | ffmpeg (H.264 / AAC) | `out/kclinics-story.mp4` |

`scene.js` holds the whole timeline. `render(t)` is a pure function of time, so the
frames are deterministic.

## Reproduce

```bash
# 1. capture the live site (needs network to kclinics.co.uk)
node story-build/recap-prod.mjs          # home, AI, portal
# 2. booking flow — build the app without a DB/Stripe key (demo mode), serve it,
#    then drive the real BookingFlow component:
./node_modules/.bin/next build && ./story-build/run-start.sh &   # serves :3000
node story-build/cap-flow.mjs            # capture/flow-*.png + taps.json
# 3. background plates + music from the supplied promo video
#    (see the gen/ffmpeg calls in build_all.sh)
# 4. composite every frame, then encode
node story-build/render.mjs full 30      # frames/*.png
./story-build/encode.sh                  # out/kclinics-story.mp4
```

`build_all.sh` runs the whole chain.

## Tweaking

- **Copy / captions:** `CAPS` in `scene.js`.
- **Timing / pacing:** the `T` and `BOOK` tables at the top of `scene.js`.
- **Which screens:** `SCREENS` in `scene.js` (re-capture with the cap scripts).
- **Music / fades:** the music-bed ffmpeg call in `build_all.sh`.

## Notes

- `app/story-demo/booking/page.tsx` is a capture-only route (unlinked, static, no
  DB) that renders the real `<BookingFlow>` with a fixed catalogue so the booking
  UI can be filmed without a database or Stripe. Remove it if you don't want it in
  the tree.
- The client portal is shown via its real sign-in page. To film the logged-in
  dashboard instead, supply a demo client login and re-capture `/account`.
