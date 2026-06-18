#!/bin/bash
# Reproducible build of the K Clinics launch Story.
# Requires: node + the repo's node_modules (Playwright, sharp), ffmpeg, and
# Chromium (PLAYWRIGHT_BROWSERS_PATH). Network access to kclinics.co.uk.
set -e
cd /home/user/K-Clinics
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
SRC="${STORY_SRC:-/root/.claude/uploads/182f37d2-1517-5b87-ab50-13f5ccf3b5f8/5500dd4e-videoplayback.mp4}"
mkdir -p story-build/{capture,assets,frames,out,recon,broll}

echo "── 1. capture live site (home / AI / portal)"
node story-build/recap-prod.mjs

echo "── 2. booking flow via the real component (demo build, no DB/Stripe)"
( unset DATABASE_URL NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY; NODE_ENV=production ./node_modules/.bin/next build )
./story-build/run-start.sh > story-build/start.log 2>&1 &
for i in $(seq 1 60); do curl -sf --noproxy '*' -o /dev/null http://127.0.0.1:3000/story-demo/booking && break; sleep 1; done
node story-build/cap-flow.mjs

echo "── 3. background plates + music from the promo video"
gen(){ ffmpeg -y -ss "$1" -i "$SRC" -frames:v 1 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=20,eq=brightness=-0.16:saturation=0.85:contrast=1.02" "story-build/assets/$2" 2>/dev/null; }
gen 10.8 bg-room.jpg; gen 34.0 bg-towels.jpg; gen 3.4 bg-interior.jpg; gen 26.0 bg-hands.jpg
ffmpeg -y -i "$SRC" -vn -ac 2 -ar 48000 story-build/broll/music_full.wav 2>/dev/null
DUR=23.5
ffmpeg -y -i story-build/broll/music_full.wav -t $DUR \
  -af "afade=t=in:st=0:d=0.6,afade=t=out:st=$(echo "$DUR-2.2"|bc):d=2.2,loudnorm=I=-14:TP=-1.5:LRA=11" \
  -ar 48000 -ac 2 story-build/assets/music_bed.wav 2>/dev/null

echo "── 4. composite every frame"
node story-build/render.mjs full 30

echo "── 5. encode"
./story-build/encode.sh
echo "DONE → story-build/out/kclinics-story.mp4"
