# Test 08 — SKILL.md key list stays complete

**Validates:** the `Key`-names block in SKILL.md still lists **every** key the
installed suchibot enum exposes. If a suchibot upgrade adds or renames a key, the
cheatsheet would silently drift out of date — this catches that, so scripts can
trust the documented list.

**Prereqs:** [00-build-image](00-build-image.md). No container needed.

## Steps + Verify (deterministic)

Dump the enum from the image and check each key appears inside the delimited
key-list block in SKILL.md (between the `KEY-LIST-START` / `KEY-LIST-END` markers):

```sh
SKILL=skills/drive-ui-in-docker/SKILL.md
section=$(awk '/KEY-LIST-START/{f=1;next} /KEY-LIST-END/{f=0} f' "$SKILL")
missing=""
for k in $(docker run --rm --entrypoint node drive-ui-in-docker:latest \
             -e 'console.log(Object.keys(require("suchibot").Key).join("\n"))' 2>/dev/null); do
  printf '%s\n' "$section" | grep -qw -- "$k" || missing="$missing $k"
done
[ -z "$missing" ] && echo "KEY_LIST_COMPLETE" || echo "MISSING from SKILL.md:$missing"
```

Expected output: **`KEY_LIST_COMPLETE`**. If it prints `MISSING …`, add the listed
key name(s) to the `KEY-LIST` block in SKILL.md.

(The `2>/dev/null` drops a harmless "Couldn't find per display information" error —
suchibot's input backend probes for an X display on load, and this bare
`docker run` has none. The enum is read before that matters.)

## Cleanup

None.
