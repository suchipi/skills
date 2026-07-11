# Extends suchipi/novnc (Xvnc + fluxbox + noVNC) with everything needed to
# drive and observe the desktop: Node + suchibot for input, ffmpeg/vncsnapshot/
# imagemagick for capture, x11-utils (geometry probe) + x11-xserver-utils
# (xrandr, for live resolution changes).

# Node.js is copied from the official image (glibc/Debian build, ABI-compatible
# with the Ubuntu 24.04 base) rather than installed via nodesource.
FROM node:20-bookworm-slim AS nodejs

FROM suchipi/novnc

# Copy the Node.js runtime from the stage above and recreate the npm/npx shims
# (the official image ships them as relative symlinks under /usr/local/bin).
COPY --from=nodejs /usr/local/bin/node /usr/local/bin/node
COPY --from=nodejs /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN set -ex; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      build-essential python3 libxtst-dev \
      ffmpeg vncsnapshot x11-utils x11-xserver-utils imagemagick; \
    npm install -g suchibot; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

# So `node /work/script.js` resolves require("suchibot") from the global install.
ENV NODE_PATH=/usr/local/lib/node_modules

# The novnc base runs fluxbox with the ubuntu-light style, which paints the
# Ubuntu logo across the root window. A plain black desktop makes captured
# screenshots much easier to read at a glance. "background: none" is fluxbox's
# documented switch to leave the root unpainted, and Xvnc initializes it to
# solid black; fluxbox copies this system template into ~/.fluxbox/overlay on
# first launch.
RUN printf '%s\n' \
      '! Solid-black desktop instead of the ubuntu-light logo wallpaper,' \
      '! so screenshots are easy to read at a glance.' \
      'background: none' \
      > /etc/X11/fluxbox/overlay

# Base image already sets ENTRYPOINT to /vnc/entrypoint.tcl, which starts the
# VNC stack and then (optionally) launches argv as the target app. We inherit it.
