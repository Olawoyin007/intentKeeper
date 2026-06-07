# Merge Checklist

Read this before creating any PR. Not optional.

The goal is zero surprises after merge: no stale docs, no out-of-sync
version strings, no missing entries in files that should have been updated.

---

## Every PR (no exceptions)

- [ ] `pytest tests/ -q` passes with no new failures
- [ ] CHANGELOG.md has an entry describing what changed and why (not just what)
- [ ] No debug prints, commented-out code, or TODO comments left behind

---

## By change type

Find your change type below and check every item in that row.

### New API endpoint (`server/api.py`)

- [ ] `docs/architecture.md` - Endpoints list in Component Relationships section
- [ ] `CLAUDE.md` - Core Components / Server section
- [ ] Tests in `tests/test_classifier.py` covering the new endpoint

### New environment variable

- [ ] `.env.example` - add with a comment explaining what it does
- [ ] `README.md` - Configuration section (if user-facing)
- [ ] `CLAUDE.md` - Required Environment Variables section
- [ ] Wired up in `server/classifier.py` or `server/api.py`

### New platform adapter (`extension/platforms/`)

- [ ] `extension/manifest.json` - URL patterns added to `content_scripts`
- [ ] `docs/architecture.md` - High-Level Overview browser line, Platform Adapters section
- [ ] `ROADMAP.md` - mark phase ✅
- [ ] `README.md` - supported platforms list updated
- [ ] `CLAUDE.md` - Architecture section (directory listing)
- [ ] Tests in `extension/tests/` or `tests/`

### New intent category (`scenarios/intents.yaml`)

- [ ] Run eval **before** the change: `python eval/run_eval.py` - record baseline
- [ ] `eval/test_set.yaml` - add labeled examples for the new intent
- [ ] Run eval **after**: accuracy must not regress
- [ ] `docs/architecture.md` - Intent Categories section (count, spectrum diagram)
- [ ] `CLAUDE.md` - intent table updated

### New extension feature (popup, `background.js`, `core/classifier.js`)

- [ ] `extension/manifest.json` - new permissions declared if required
- [ ] `docs/architecture.md` - Component Relationships if new storage keys or APIs used
- [ ] Extension tests in `extension/tests/`

### Dependency change (`pyproject.toml` or `extension/package.json`)

- [ ] `Dockerfile` - any layer caching implications?
- [ ] Verify end-to-end install still works

---

## Release procedure

A release is any PR that bumps the public version number.
**All four version-bearing files must match before the PR is merged.**

### Version-bearing files (update all four, in this order)

| File | Location | Note |
|------|----------|------|
| `pyproject.toml` | `version = "..."` | source of truth |
| `extension/manifest.json` | `"version": "..."` | must match pyproject.toml |
| `README.md` | version badge | must match |
| `CHANGELOG.md` | top entry header | rename `[Unreleased]` to `vX.Y.Z (YYYY-MM-DD)` |

To verify all four are consistent before merging, run:
```bash
python scripts/check_version.py
```

### Release steps (in order)

1. Update all four version-bearing files above
2. Run `python scripts/check_version.py` - must pass
3. Run `pytest tests/ -q` - must pass
4. Run `python eval/run_eval.py` - note accuracy, must not regress from baseline
5. Update `ROADMAP.md` - mark completed phase ✅, update Current Status section
6. Commit: `chore: release vX.Y.Z`
7. Push, create PR, merge
8. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
9. GitHub release: create from tag, paste CHANGELOG entry as description

---

## When to update this checklist

Update this file when the **shape of the project changes** - a new kind of
thing appears that this checklist does not have a row for yet.

Examples that require a new row:
- A new browser is officially supported
- A new top-level source directory is added
- A new external integration is added (database, service, API)

Adding a new instance of an existing type (new endpoint, new platform, new
intent) does NOT require updating this checklist - the existing rows cover it.

---

## Quick reference - what contains what

| Concept | Files that must stay in sync |
|---------|------------------------------|
| Version string | `pyproject.toml`, `extension/manifest.json`, `README.md` badge, `CHANGELOG.md` header |
| API endpoints | `server/api.py`, `docs/architecture.md`, `CLAUDE.md` |
| Environment variables | `.env.example`, `README.md`, `CLAUDE.md`, `server/classifier.py` / `server/api.py` |
| Platform support | `extension/manifest.json`, `extension/platforms/`, `docs/architecture.md`, `README.md`, `ROADMAP.md` |
| Intent categories | `scenarios/intents.yaml`, `eval/test_set.yaml`, `docs/architecture.md`, `CLAUDE.md` |
| Eval baseline | `eval/test_set.yaml`, `CLAUDE.md` baseline percentage and date |
