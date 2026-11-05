# Test 03 - Stop all, and stale records

**Validates:** `stop` with no port stops every server started from the work dir, and a leftover run record whose pid now belongs to an unrelated process is cleared without killing that process.

## Steps

```sh
export MARKDOWN_COMMENTER_WORK=.tmp/comment-on-markdown-03
MC=skills/comment-on-markdown/scripts/markdown-commenter.mjs
DOC=skills/comment-on-markdown/skill-tests/fixtures/doc.md
node $MC start $DOC --no-open
node $MC start $DOC --no-open

# a record left behind by a server that died, whose pid was since reused
sleep 60 & UNRELATED=$!
printf '{"pid":%s,"port":1,"url":"http://localhost:1","input":"/x.md","comments":"/x.comments.md","log":"/x.log"}\n' $UNRELATED \
  > .tmp/comment-on-markdown-03/servers/1.json

node $MC stop; echo "exit=$?"
kill -0 $UNRELATED && echo "unrelated process survived"
kill $UNRELATED
ls .tmp/comment-on-markdown-03/servers
pgrep -f comment-on-markdown-03/app/src/server.js || echo "no servers left"
node $MC stop
```

## Verify

- Deterministic:
  - The first `stop` prints `port 1 had already exited; comments: /x.comments.md` and two `stopped port ...` lines, then `exit=0`.
  - `unrelated process survived` is printed. Killing it would mean `stop` trusted a pid without checking its command line.
  - `servers/` is empty, `pgrep` finds nothing, and the last `stop` prints `no servers were started from ...`.

## Cleanup

```sh
rm -rf .tmp/comment-on-markdown-03
```
