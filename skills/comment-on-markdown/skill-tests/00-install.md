# Test 00 - Install

**Validates:** the first `start` clones markdown-commenter into the work dir and installs its dependencies, and a second `start` reuses that install without running npm again.

## Steps

```sh
export MARKDOWN_COMMENTER_WORK=.tmp/comment-on-markdown-00
MC=skills/comment-on-markdown/scripts/markdown-commenter.mjs
DOC=skills/comment-on-markdown/skill-tests/fixtures/doc.md
node --version
node $MC start $DOC --no-open
node $MC stop
node $MC start $DOC --no-open
node $MC stop
```

## Verify

- Deterministic:
  ```sh
  git -C .tmp/comment-on-markdown-00/app remote get-url origin   # -> https://github.com/suchipi/markdown-commenter.git
  test "$(git -C .tmp/comment-on-markdown-00/app rev-parse HEAD)" = "$(cat .tmp/comment-on-markdown-00/app/node_modules/.installed-commit)" && echo marker ok
  test -d .tmp/comment-on-markdown-00/app/node_modules/remark-parse && echo dev deps ok
  ls .tmp/comment-on-markdown-00 | grep partial || echo "no staging dir left"
  ```
  `node --version` must be >= v20.11. The first `start` prints npm's `added N packages` line; the second doesn't. Both print `markdown-commenter is running.` with a URL.

## Cleanup

```sh
rm -rf .tmp/comment-on-markdown-00
```
