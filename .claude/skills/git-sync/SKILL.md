---
name: git-sync
description: Pull, merge, resolve conflicts, verify, and push for the AstraSight repo, without stopping to ask. Use it automatically at the start of every session, after every finished piece of work (a feature, fix, restyle, or docs change), before ending a session, and whenever a push is rejected or a pull shows conflicts. Also use it when the user says "sync", "pull", "push", "update from the team", or "/git-sync".
---

# Git sync

Several Claude instances push to `main` at once, from different machines and sometimes from the same folder. Run this whole loop **on your own, without asking the user**, every time the description says to. The goal: every feature from every instance still works after the merge. Never silently drop anyone's work.

The team has given standing approval for this skill to commit your own work and push to `origin main`. The forbidden commands below still need the user's explicit say-so.

## Never
`git push --force`, `git reset --hard`, `git checkout -- <file>`, `git restore` on others' files, `git clean`, `git stash`, `git rebase`, `git merge -X ours|theirs`, or `git checkout --ours|--theirs` on whole files. If one of these looks necessary, stop and ask the user.

## 1. Look before you pull
```sh
git status --short
git fetch origin
git log --oneline HEAD..origin/main          # incoming commits
git diff --stat HEAD...origin/main           # incoming files
git show origin/main:docs/HISTORY.md | tail -40   # why they changed it
```
Modified files you didn't touch in this session belong to another instance working in the same folder. Leave them out of your commit, and don't reset or stash them.

## 2. Commit your own finished work
- Stage paths one by one with `git add <path>`, never `git add -A` or `git add .`.
- If the work is significant, append a `docs/HISTORY.md` entry at the bottom first (template in that file) and stage it in the same commit.
- Check `git diff --staged` against the "Public repo rules" in CLAUDE.md: no secrets other than the shared ElevenLabs key, no `.env`, no emails, no `C:\Users\…` or `/home/…` paths, no private chat content. If something is found, unstage it and tell the user.
- `git commit -m "<what changed>"`, ending the message with the attribution line from the system reminder, if one was given.

## 3. Pull with a merge
```sh
git pull --no-rebase origin main
```
If git reports no conflicts, go to step 5, because silent conflicts still happen.

## 4. Resolve conflicts yourself
For each file in `git diff --name-only --diff-filter=U`:
1. Read the whole file with both sides, plus the HISTORY entries behind each side. Use `git log --oneline -3 MERGE_HEAD -- <file>` and `git log --oneline -3 HEAD -- <file>` to find out who changed what.
2. **Combine both sides.** Don't pick one:
   - Registries take the union of both sides: `TOOLS` and `ICONS` (`js/data.js`), `TOOL_ALIASES`, `RULES` and `SYMPTOMS` (`js/vega.js`), `NAV_LINKS` (`js/common.js`), CSS tokens and rules, routes in `server.js` and `server/`, `.env.example` keys, `<script>` and `<link>` tags (keep the load order `data.js` → `common.js` → `auth.js` → `vega.js` → page script, with `arcade.css` loaded last), README and CLAUDE.md tables.
   - When both sides changed the same function, write merged logic so both behaviors survive.
   - `docs/HISTORY.md`: keep every entry, in chronological order.
   - Lockfiles and generated files: regenerate them, don't hand-merge.
3. Remove every marker, then `git add <file>`.
4. **Genuine contradictions** (the same feature built two incompatible ways, or opposite decisions in HISTORY): keep what HISTORY agreed on, or keep both behind a clear switch. Write a **Discrepancy:** line in your HISTORY entry and tell the user at the end. Don't block on it.

## 5. Verify the merge (conflicts or not)
```sh
git grep -nE '^(<<<<<<<|=======|>>>>>>>)'    # must print nothing
git diff --name-only ORIG_HEAD HEAD -- '*.js' | xargs -r -n1 node --check
```
Then look for silent breakage in the merged files: IDs or keys defined twice, a renamed function still called by its old name, a page that uses a script it no longer loads, two implementations of one feature, and CLAUDE.md tables that don't match the files.

If HTML, JS, or CSS changed, start `node server.js`, load every page with the `webapp-testing` skill, and check for page errors. At minimum, the home, HUD, tools, VEGA, and report pages must render and one typed command must work. Fix anything broken, then commit the fixes (`git commit` to finish the merge if one is in progress, or a new commit after it).

## 6. Push
```sh
git fetch origin
git log --oneline HEAD..origin/main   # anything new? go back to step 3
git push origin main
```
If the push is rejected as non-fast-forward, go back to step 3 and repeat. After 3 failed rounds, stop and tell the user. **Never force.**

## 7. Report
Tell the user in a few lines: what came in (by HISTORY author), what you pushed, how each conflict was resolved, any open discrepancy, and any files left uncommitted because they belong to another instance.
