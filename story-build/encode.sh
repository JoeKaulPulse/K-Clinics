#!/bin/bash
# Encode the rendered frames + music bed into the final 1080x1920 Story MP4.
set -e
cd /home/user/K-Clinics
mkdir -p story-build/out
ffmpeg -y -framerate 30 -i story-build/frames/%04d.png -i story-build/assets/music_bed.wav \
  -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p -crf 17 -preset slow \
  -r 30 -movflags +faststart \
  -c:a aac -b:a 192k -ac 2 -shortest \
  story-build/out/kclinics-story.mp4
echo "ENCODED:"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 story-build/out/kclinics-story.mp4
