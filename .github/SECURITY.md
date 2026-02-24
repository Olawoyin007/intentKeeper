# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

IntentKeeper takes security seriously, especially given our local-first architecture and browser extension integration.

### Critical Issues (Report Immediately)

If you discover a vulnerability in:

- **Classification bypass** (content that evades intent detection in a way that could cause harm)
- **Browser extension security** (XSS, injection, or privilege escalation in the extension)
- **Data privacy** (unintended data transmission, telemetry, or content exposure)
- **Server-side vulnerabilities** (code injection, path traversal, or API abuse)

Please report these **privately** by opening a [private security advisory on GitHub](https://github.com/Olawoyin007/intentKeeper/security/advisories/new).

**Do NOT open a public issue for security vulnerabilities.**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity, but privacy and extension security issues are highest priority

### What Counts as a Security Issue

- Browser extension vulnerabilities (XSS, content injection, CSP bypass)
- API server vulnerabilities (injection, SSRF, denial of service)
- Data exposure (classified content leaking, cache data accessible to other origins)
- Dependency vulnerabilities with a viable exploit path
- Bypass of the fail-open design that causes content to be incorrectly hidden or blocked

### What Does NOT Count

- Issues with Ollama itself (report to [Ollama](https://github.com/ollama/ollama))
- Theoretical attacks requiring physical access to the user's machine
- Classification accuracy issues (these are feature requests, not security bugs)
- Social engineering attacks
- Issues already documented as limitations

## Security Architecture

IntentKeeper's security model is built on:

1. **Local-first** - All classification runs on user hardware via Ollama. No content is sent to external services.
2. **Fail-open** - If classification fails, content passes through unchanged. The system never silently blocks or hides content due to errors.
3. **Minimal permissions** - The browser extension requests only the permissions it needs.
4. **No telemetry** - Zero tracking, analytics, or usage data collection.

## Automated Security Scanning

This project runs automated security checks on every push and PR:

- **pip-audit** - Dependency vulnerability scanning
- **CodeQL** - Static analysis for code vulnerabilities
- **Gitleaks** - Secret detection in commits

Thank you for helping keep IntentKeeper safe for everyone.
