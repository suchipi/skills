# Test 02 - Comments files

**Validates:** every `start` creates a new comments file, even several in the same second; concurrent first-time starts all succeed; `--comments` reuses an earlier file and the server loads its comments; and `start` refuses a comments path that is the input file or is already in use by a running server.

## Steps

```sh
export MARKDOWN_COMMENTER_WORK=.tmp/comment-on-markdown-02
MC=skills/comment-on-markdown/scripts/markdown-commenter.mjs
DOC=skills/comment-on-markdown/skill-tests/fixtures/doc.md

# three at once on a fresh work dir, so they race to install and share a timestamp
(node $MC start $DOC --no-open & node $MC start $DOC --no-open & node $MC start $DOC --no-open & wait) 2>&1 | grep -E 'comments:|markdown-commenter:|Error'
ls .tmp/comment-on-markdown-02 .tmp/comment-on-markdown-02/comments
node $MC stop

# put a comment in one file, then reuse it
OUT=$(node $MC start $DOC --no-open); PORT=$(echo "$OUT" | sed -n 's/^Stop it with: stop //p'); OLD=$(echo "$OUT" | sed -n 's/^  comments: //p')
curl -s -X POST -H 'content-type: application/json' -d '{"selectedText":"A list item","sourceLine":5,"startPath":"2/0/0","startOffset":0,"endPath":"2/0/0","endOffset":11,"comment":"Reused?"}' http://localhost:$PORT/api/comments >/dev/null
node $MC stop $PORT
OUT=$(node $MC start $DOC --no-open --comments "$OLD"); echo "$OUT"; PORT=$(echo "$OUT" | sed -n 's/^Stop it with: stop //p')
curl -s http://localhost:$PORT/api/comments; echo

node $MC start $DOC --no-open --comments "$OLD"; echo "exit=$?"
node $MC start $DOC --no-open --comments "./$DOC"; echo "exit=$?"
node $MC start .tmp/no-such-file.md --no-open; echo "exit=$?"
node $MC stop
ls .tmp/comment-on-markdown-02/comments | wc -l
```

## Verify

- Deterministic:
  - The three parallel starts print three **different** comments paths and nothing else: no `markdown-commenter:` errors and no stack traces. When they share a timestamp, the names are `doc-<stamp>.md`, `doc-<stamp>-2.md`, `doc-<stamp>-3.md`.
  - The work dir holds `app`, `comments`, and `servers`, with no `app.partial-*` staging dirs left behind.
  - If you rerun this test without its cleanup, the parallel starts may print `couldn't update the app; using the copy already installed`, since their `git pull`s collide. That warning is harmless.
  - The reuse `start` prints `comments: <OLD>`, and the `curl` returns a JSON array holding the `Reused?` comment.
  - Starting a second server on `<OLD>` prints `... is already in use by the server on port <PORT>` and `exit=1`.
  - `--comments` pointing at the input prints `the comments file can't be the input file; markdown-commenter would overwrite it` and `exit=1`. The fixture is unchanged (`git diff --stat skills/comment-on-markdown/skill-tests/fixtures` prints nothing).
  - A missing input prints `not a file: ...` and `exit=1`.
  - The final count is `4`: `stop` deletes no comments files, and the reuse created no new one.

## Cleanup

```sh
rm -rf .tmp/comment-on-markdown-02
```
