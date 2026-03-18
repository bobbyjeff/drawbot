# Security Findings Summary

Generated on 2026-03-12 from refreshed DynamoDB data.

## Refreshed Data Files

- `security_bugbot_findings_raw.json`: full scan of `security-bugbot-findings`
- `security_gate_status_raw.json`: full scan of `security-gate-status`
- `security_resolution_analysis.json`: run-level failure-to-success analysis
- `security_current_findings_summary.json`: current-only summary metrics
- `security_current_findings_per_day.json`: current-only daily rollup
- `security_current_findings_per_week.json`: current-only weekly rollup
- `security_current_findings_per_day.svg`: daily chart for presentation
- `security_current_findings_per_week.svg`: weekly chart for presentation

## Current-Only Dataset Window

This summary is scoped to current findings only (`version == "current"`).

- Findings table created: 2026-01-21T13:50:50.310000-08:00
- Earliest current finding: 2026-02-06T20:53:16.605253
- Latest current finding: 2026-03-12T13:47:22.125005
- Span: 35 days
- Current findings: 997
- Unique PRs with current findings: 653

Suggested topline:

- 997 current findings across 653 PRs over 35 days

## Current-Only Severity Mix

- Medium: 912
- High: 64
- Critical: 19
- Low: 2

## Most Common Current Vulnerability Families

These counts come from a coarse heuristic classifier over finding descriptions, impacts, and remediations.

- Sensitive data exposure: 392 (39.3%)
- Auth or policy bypass: 235 (23.6%)
- Other / uncategorized: 210 (21.1%)
- Command or code execution: 53 (5.3%)
- DoS or missing rate limits: 29 (2.9%)
- Path traversal or file write: 23 (2.3%)
- Unsafe deserialization: 15 (1.5%)
- XSS or HTML injection: 12 (1.2%)

## Findings Over Time

Daily:

- 35 calendar days with findings
- Average findings per day: 28.49
- Peak day: 2026-02-19 with 73 findings across 52 PRs

Weekly:

- 6 calendar weeks represented
- Average findings per week: 166.17
- Peak week: 2026-02-16 with 274 findings across 163 PRs

Weekly breakdown:

- Week of 2026-02-02: 70 findings across 46 PRs
- Week of 2026-02-09: 219 findings across 151 PRs
- Week of 2026-02-16: 274 findings across 163 PRs
- Week of 2026-02-23: 189 findings across 130 PRs
- Week of 2026-03-02: 176 findings across 130 PRs
- Week of 2026-03-09: 69 findings across 52 PRs