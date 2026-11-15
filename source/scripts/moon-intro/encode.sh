#!/bin/sh
# usage: encode.sh RAW_DIR  -> public/moon/intro/{name.mp4,name.jpg}
RAW="$1"; DST="$(dirname "$0")/../../public/moon/intro"; mkdir -p "$DST"
for f in "$RAW"/*.mp4; do
  n=$(basename "$f" .mp4)
  ffmpeg -y -loglevel error -i "$f" -an -vf "scale=1280:720:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf ${CRF:-26} -maxrate 2800k -bufsize 5600k -movflags +faststart "$DST/$n.mp4"
  src="$RAW/$n.png"; [ -f "$src" ] || src="$RAW/$(echo $n | sed 's/_journey/1_earth/;s/_fall/1_fall/')".png
  [ -f "$src" ] && ffmpeg -y -loglevel error -i "$src" -vf scale=1280:720 -q:v 4 "$DST/$n.jpg"
done
du -ch "$DST"/*.mp4 | tail -1
