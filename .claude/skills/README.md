# Project skills

Claude Code loads these automatically for anyone who clones the repo.

| Skill | Source | License |
|-------|--------|---------|
| `space-health-research` | Written for this project | Same as repo |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) @ `2c5958e`, unmodified | Apache-2.0 (see its `LICENSE.txt`) |
| `webapp-testing` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) @ `2c5958e`, unmodified | Apache-2.0 (see its `LICENSE.txt`) |

`webapp-testing` setup: `pip install playwright && playwright install chromium`, then for example
`python .claude/skills/webapp-testing/scripts/with_server.py --server "python -m http.server 8000" --port 8000 -- python your_test.py`.
Its examples write to Linux paths like `/tmp` or `/mnt/...`. On Windows, save to `.screenshots/` instead (gitignored).
