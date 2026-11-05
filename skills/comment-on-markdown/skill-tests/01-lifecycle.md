# Test 01 - Lifecycle

**Validates:** `start` serves the rendered document on the port it prints, a comment posted to the server lands in the comments file, and `stop` kills the server, removes its run record, and keeps the comments file.

## Steps

```sh
export MARKDOWN_COMMENTER_WORK=.tmp/comment-on-markdown-01
MC=skills/comment-on-markdown/scripts/markdown-commenter.mjs
DOC=skills/comment-on-markdown/skill-tests/fixtures/doc.md
OUT=$(node $MC start $DOC --no-open); echo "$OUT"
PORT=$(echo "$OUT" | sed -n 's/^Stop it with: stop //p')
COMMENTS=$(echo "$OUT" | sed -n 's/^  comments: //p')
PID=$(node -p "require('./.tmp/comment-on-markdown-01/servers/$PORT.json').pid")
curl -s http://localhost:$PORT/ | grep -c 'Fixture document'
curl -s -X POST -H 'content-type: application/json' \
  -d '{"selectedText":"something to comment on","sourceLine":3,"startPath":"1/0","startOffset":30,"endPath":"1/0","endOffset":53,"comment":"Say what, exactly?"}' \
  http://localhost:$PORT/api/comments
cat "$COMMENTS"
node $MC stop $PORT; echo "exit=$?"
kill -0 $PID 2>/dev/null && echo "BUG: server still running"
ls .tmp/comment-on-markdown-01/servers
cat "$COMMENTS"
node $MC stop $PORT; echo "exit=$?"
```

## Verify

- Deterministic:
  - `start` prints `markdown-commenter is running.`, a `localhost` URL, the absolute input path, and a comments path matching `.tmp/comment-on-markdown-01/comments/doc-YYYYMMDD-HHMMSS.md`.
  - The `grep -c` prints `1`.
  - The first `cat` shows a `# Line 3:` section with `something to comment on` under Selected Content and `Say what, exactly?` under Comment.
  - `stop` prints `stopped port <PORT>; comments: <COMMENTS>` and `exit=0`. The `kill -0` line prints nothing, and `servers/` is empty.
  - The second `cat` still shows the comment.
  - The second `stop` prints `no server on port <PORT> was started from ...` and `exit=1`.

## Cleanup

```sh
rm -rf .tmp/comment-on-markdown-01
```
