---
name: comment-on-markdown
description: >-
  Open a Markdown file in markdown-commenter so the user can highlight text and
  leave review comments on it in the browser, then stop the server and address
  the comments once they say they're done.
disable-model-invocation: true
argument-hint: <file.md>
---

# Comment on Markdown

Run [markdown-commenter](https://github.com/suchipi/markdown-commenter) on the file named in this skill's arguments. It renders the document in the user's browser, where they can highlight text or click on images to comment, and it saves every comment to a separate comments file. When the user says they're done, stop the server and address the comments.

If no file was given, ask which one to open.

Everything goes through one helper script, `${CLAUDE_SKILL_DIR}/scripts/markdown-commenter.mjs`. It needs Node >= 20.11, git, and npm.

## 1. Choose the work dir

The comments files, server logs, and the markdown-commenter install all live in one work dir, so it has to be somewhere scratch files are welcome:

1. Get the repo root with `git rev-parse --show-toplevel`. If that fails, the project isn't a git repo: go to step 3.
2. Read `<root>/.gitignore` and look for an ignored **general-purpose scratch directory** - `.tmp/`, `tmp/`, `temp/`, `.temp/`, `scratch/`, or similar. If there is one, use `<root>/<that dir>/markdown-commenter`. Skip any entry that is ignored for a *specific* purpose, however tmp-ish its name sounds: build output (`dist/`, `build/`, `out/`, `target/`, `.next/`), tool caches (`.cache/`, `.parcel-cache/`, `.pytest_cache/`, `node_modules/.cache/`), coverage, logs, or anything scoped to one tool. Those belong to something else, which may delete the comments out from under the user. If the only candidates look like that, go to step 3.
3. No repo, or no general-purpose scratch dir: use `/tmp/markdown-commenter`.

Don't edit `.gitignore` or invent a new ignored directory just to have somewhere to write. An explicit project instruction naming a scratch dir outranks all of this.

Pass the work dir as `MARKDOWN_COMMENTER_WORK` on every command, and use the same one for `start` and `stop`. Shell variables don't carry over between Bash calls, so set it inline each time.

## 2. Start the server

```sh
MARKDOWN_COMMENTER_WORK=<work dir> node "${CLAUDE_SKILL_DIR}/scripts/markdown-commenter.mjs" start <file.md>
```

`start` does the following, then prints the URL, the comments file path, and the port:

- Clones markdown-commenter into `<work dir>/app` on first use, and pulls updates on later runs.
- Creates a new, empty comments file at `<work dir>/comments/<name>-<YYYYMMDD-HHMMSS>.md`, so every run gets its own.
- Starts the server on a free port in the background.
- Opens the URL in the default browser. Add `--no-open` when that won't reach the user, such as when Claude Code runs on a remote machine.

Tell the user the URL and the comments file path, and that you'll address the comments when they tell you they're done. Then end your turn. Don't read the comments file or poll the server while they're commenting, and if they message you about something else in the meantime, leave the server running.

## 3. When the user is done

1. Stop the server, passing the port `start` printed:
   ```sh
   MARKDOWN_COMMENTER_WORK=<work dir> node "${CLAUDE_SKILL_DIR}/scripts/markdown-commenter.mjs" stop <port>
   ```
   If you've lost track of the port, `stop` with no port stops every server started from that work dir. Either way it prints the comments file path.
2. Read the comments file, then the document.
3. Address each comment the way it asks: edit the document for requested changes, and answer questions in your reply. If a comment's intent is unclear, ask the user instead of guessing.
4. Tell the user what you did for each comment.

**Never delete comments files**, including after you've addressed them.

## Comments file format

Each comment is a section like this, with sections separated by `---`:

```md
<!-- id: eyJpZCI6Im13Mnd6aDhhb3dwcCIsInNvdXJjZUxpbmUiOjcs... -->

# Line 7:

## Selected Content:
Neat, huh?

## Comment:
Is it, though?
```

- `# Line N:` is the line in the document where the block containing the selection starts, usually a paragraph or list item. In a long paragraph, the selected text can be several lines below it. The heading is missing when no line could be determined.
- For image comments, Selected Content reads like `Image: ./sample-image.png at (42%, 17%)`.
- The `id` line holds position data the server uses to restore highlights. Ignore it.
- An empty file means the user left no comments.

## Reusing a comments file

Use a new comments file for every run unless the user asks to continue from an earlier one. In that case, pass it to `start` with `--comments <path>`. The server loads its comments and restores their highlights, though highlights can land in the wrong place if the document changed since. Earlier files are in `<work dir>/comments/`, named after the document and the time the run started. Only pass a markdown-commenter comments file, because the server overwrites anything else in it on the first save.

## Notes

- markdown-commenter listens on all network interfaces and serves any file the user can read by absolute path, so don't leave it running past the review.
- The server re-reads the document on every page load, so refreshing the page shows edits made since.
- If `start` fails partway through installing, rerunning it retries. The server's own log is in `<work dir>/servers/<port>.log` while it runs, and `stop` prints it if the server had already exited.
