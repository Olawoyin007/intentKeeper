"""
Tests for the Reddit platform adapter.

Since the adapter is JavaScript, these tests validate:
- File exists and is syntactically coherent (basic string checks)
- Required adapter interface is present (platform, baseSelector, extractText, etc.)
- All three Reddit variants are handled (shreddit, new reddit, old reddit)
- Manifest includes reddit.com matches

JS-level unit tests (DOM manipulation, extraction logic) would require a Node.js
test runner (Jest/Vitest). These Python tests guard the structural contract.
"""

import json
from pathlib import Path

EXTENSION_DIR = Path(__file__).parent.parent / "extension"
REDDIT_JS = EXTENSION_DIR / "platforms" / "reddit.js"
MANIFEST = EXTENSION_DIR / "manifest.json"


class TestRedditAdapterFile:
    """Validate reddit.js exists and has the required adapter interface."""

    def test_reddit_js_exists(self):
        assert REDDIT_JS.exists(), "extension/platforms/reddit.js not found"

    def test_adapter_object_defined(self):
        src = REDDIT_JS.read_text()
        assert "redditAdapter" in src

    def test_platform_field_set(self):
        src = REDDIT_JS.read_text()
        assert "platform: 'reddit'" in src

    def test_base_selector_defined(self):
        src = REDDIT_JS.read_text()
        assert "baseSelector" in src

    def test_get_content_element_defined(self):
        src = REDDIT_JS.read_text()
        assert "getContentElement" in src

    def test_get_blur_container_defined(self):
        src = REDDIT_JS.read_text()
        assert "getBlurContainer" in src

    def test_extract_text_defined(self):
        src = REDDIT_JS.read_text()
        assert "extractText" in src

    def test_intentkeepercore_init_called(self):
        src = REDDIT_JS.read_text()
        assert "IntentKeeperCore.init(redditAdapter)" in src

    def test_module_exports_for_testing(self):
        src = REDDIT_JS.read_text()
        assert "module.exports" in src


class TestRedditVariantCoverage:
    """Confirm all three Reddit DOM variants are handled."""

    def test_shreddit_post_handled(self):
        src = REDDIT_JS.read_text()
        assert "shreddit-post" in src

    def test_shreddit_comment_handled(self):
        src = REDDIT_JS.read_text()
        assert "shreddit-comment" in src

    def test_old_new_reddit_handled(self):
        src = REDDIT_JS.read_text()
        # Old new Reddit uses data-testid attributes
        assert "data-testid" in src
        assert "post-container" in src

    def test_old_reddit_handled(self):
        src = REDDIT_JS.read_text()
        assert "old.reddit.com" in src
        assert ".thing.link" in src
        assert ".thing.comment" in src

    def test_isOldReddit_detection(self):
        src = REDDIT_JS.read_text()
        assert "isOldReddit" in src

    def test_isShreddit_detection(self):
        src = REDDIT_JS.read_text()
        assert "isShreddit" in src

    def test_comment_text_capped(self):
        """Comment text should be sliced to prevent very long LLM prompts."""
        src = REDDIT_JS.read_text()
        assert "slice(0, 400)" in src

    def test_subreddit_context_included(self):
        """Subreddit name should be included in extracted text for context."""
        src = REDDIT_JS.read_text()
        assert "subreddit" in src.lower()


class TestManifestRedditMatches:
    """Validate manifest.json includes Reddit URL matches."""

    def test_manifest_has_reddit_matches(self):
        manifest = json.loads(MANIFEST.read_text())
        all_matches = []
        for entry in manifest.get("content_scripts", []):
            all_matches.extend(entry.get("matches", []))
        reddit_matches = [m for m in all_matches if "reddit" in m]
        assert len(reddit_matches) > 0, "No Reddit URLs in manifest content_scripts"

    def test_manifest_covers_new_reddit(self):
        manifest = json.loads(MANIFEST.read_text())
        all_matches = []
        for entry in manifest.get("content_scripts", []):
            all_matches.extend(entry.get("matches", []))
        assert any("www.reddit.com" in m for m in all_matches)

    def test_manifest_covers_old_reddit(self):
        manifest = json.loads(MANIFEST.read_text())
        all_matches = []
        for entry in manifest.get("content_scripts", []):
            all_matches.extend(entry.get("matches", []))
        assert any("old.reddit.com" in m for m in all_matches)

    def test_manifest_reddit_uses_classifier_core(self):
        manifest = json.loads(MANIFEST.read_text())
        for entry in manifest.get("content_scripts", []):
            if any("reddit" in m for m in entry.get("matches", [])):
                assert "core/classifier.js" in entry.get("js", [])
                assert "platforms/reddit.js" in entry.get("js", [])
                break
        else:
            raise AssertionError("No Reddit content script entry found")

    def test_manifest_reddit_includes_styles(self):
        manifest = json.loads(MANIFEST.read_text())
        for entry in manifest.get("content_scripts", []):
            if any("reddit" in m for m in entry.get("matches", [])):
                assert "styles.css" in entry.get("css", [])
                break
