#!/usr/bin/env python3
"""
Version consistency checker for intentKeeper.

Reads the authoritative version from pyproject.toml and verifies that
every other version-bearing file references the same version.

Usage:
    python scripts/check_version.py        # from repo root
    python scripts/check_version.py --fix  # show fix hints too

Exit codes:
    0 - all files consistent
    1 - one or more mismatches found
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_pyproject_version():
    """Source of truth. Must exist and have a parseable version field."""
    path = ROOT / "pyproject.toml"
    if not path.exists():
        return None, "pyproject.toml not found"
    match = re.search(r'^version\s*=\s*"([^"]+)"', path.read_text(), re.MULTILINE)
    if not match:
        return None, "pyproject.toml: version field not found"
    return match.group(1), None


def read_manifest_version():
    path = ROOT / "extension" / "manifest.json"
    if not path.exists():
        return None, "extension/manifest.json not found"
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        return None, f"extension/manifest.json: JSON parse error: {e}"
    version = data.get("version")
    if not version:
        return None, 'extension/manifest.json: "version" field not found'
    return version, None


def read_readme_version():
    path = ROOT / "README.md"
    if not path.exists():
        return None, "README.md not found"
    match = re.search(r"version-([0-9]+\.[0-9]+(?:\.[0-9]+)?)-", path.read_text())
    if not match:
        return None, "README.md: version badge not found (expected version-X.Y.Z-...)"
    return match.group(1), None


def read_changelog_version():
    path = ROOT / "CHANGELOG.md"
    if not path.exists():
        return None, "CHANGELOG.md not found"
    match = re.search(r"^## v([0-9]+\.[0-9]+(?:\.[0-9]+)?)", path.read_text(), re.MULTILINE)
    if not match:
        return None, "CHANGELOG.md: no versioned header found (e.g. '## v0.5.1')"
    return match.group(1), None


CHECKS = [
    (
        "extension/manifest.json",
        read_manifest_version,
        'Update "version": "{version}" in extension/manifest.json',
    ),
    (
        "README.md",
        read_readme_version,
        "Update the version badge to version-{version}-green.svg",
    ),
    (
        "CHANGELOG.md",
        read_changelog_version,
        "Rename the top entry to ## v{version} (YYYY-MM-DD)",
    ),
]


def main():
    parser = argparse.ArgumentParser(description="Check intentKeeper version consistency")
    parser.add_argument("--fix", action="store_true", help="Show fix hints for each failure")
    args = parser.parse_args()

    canonical, err = read_pyproject_version()
    if err:
        print(f"ERROR: {err}")
        sys.exit(1)

    print(f"Authoritative version (pyproject.toml): {canonical}\n")

    failures = []
    for label, reader, fix_hint in CHECKS:
        found, err = reader()
        if err:
            print(f"  FAIL  {label}")
            print(f"        {err}")
            failures.append((label, fix_hint.format(version=canonical)))
        elif found != canonical:
            print(f"  FAIL  {label}")
            print(f"        found {found!r}, expected {canonical!r}")
            failures.append((label, fix_hint.format(version=canonical)))
        else:
            print(f"  OK    {label}  ({found})")

    print()

    if not failures:
        print("All version references consistent.")
        sys.exit(0)

    print(f"{len(failures)} file(s) out of sync.\n")

    if args.fix:
        print("Fix hints:")
        for label, hint in failures:
            print(f"  {label}: {hint}")
        print()
    else:
        print("Run with --fix to see fix hints.")

    sys.exit(1)


if __name__ == "__main__":
    main()
