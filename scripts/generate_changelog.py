#!/usr/bin/env python3
"""Generate a weekly changelog .docx for the ARTES platform.

Usage:
    python3 scripts/generate_changelog.py [--days N]

Defaults to the past 7 days. Output is saved to docs/changelog_YYYY-MM-DD.docx.
Requires: pip install python-docx
"""

import argparse
import subprocess
from datetime import date, timedelta

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

NAVY  = RGBColor(0x1B, 0x2A, 0x47)
GREY  = RGBColor(0x6B, 0x7C, 0x93)
LGREY = RGBColor(0x9A, 0xA5, 0xB4)

AREA_KEYWORDS = {
    "Mobile App": ["mobile", "ionic", "capacitor", "ios", "android", "push notif", "biometric", "haptic"],
    "Multilingual / i18n": ["i18n", "translat", "locale", "lang", "flag picker", "l10n"],
    "Authentication & Sessions": ["auth", "session", "token", "login", "logout", "2fa", "jwt", "refresh"],
    "Security": ["recaptcha", "captcha", "cors", "xss", "csp", "security", "sanitiz"],
    "Booking System": ["booking", "calendar", "gcal", "schedule", "slot", "availability"],
    "Coaching Module": ["coaching", "coach", "coachee", "engagement", "idp", "grow"],
    "Conflict Intelligence": ["conflict", "risk", "escalat"],
    "AI / Assessments": ["ai", "claude", "prompt", "assessment", "intake", "instrument", "hnp", "survey"],
    "Document Generation": ["pdf", "docx", "toolkit", "s3", "download"],
    "Message Hub": ["hub", "message", "notif", "unread"],
    "Infrastructure & CI": ["ci", "build", "deploy", "docker", "node", "npm", "budget", "cocoapod", "firebase"],
    "Bug Fixes": ["fix", "bug", "patch", "hotfix", "revert"],
}


def get_commits(days: int) -> list[dict]:
    since = (date.today() - timedelta(days=days)).isoformat()
    result = subprocess.run(
        ["git", "log", "--format=%H%x1f%s%x1f%b%x1e", f"--since={since}", "--reverse"],
        capture_output=True, text=True, check=True,
    )
    commits = []
    for record in result.stdout.strip().split("\x1e"):
        record = record.strip()
        if not record:
            continue
        parts = record.split("\x1f")
        commits.append({
            "hash":    parts[0].strip() if len(parts) > 0 else "",
            "subject": parts[1].strip() if len(parts) > 1 else "",
            "body":    parts[2].strip() if len(parts) > 2 else "",
        })
    return commits


def classify(subject: str) -> str:
    lower = subject.lower()
    for area, keywords in AREA_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return area
    return "Other"


def group_commits(commits: list[dict]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for c in commits:
        area = classify(c["subject"])
        groups.setdefault(area, []).append(c["subject"])
    # Preserve keyword-dict order, drop empty areas
    ordered = {k: groups[k] for k in AREA_KEYWORDS if k in groups}
    if "Other" in groups:
        ordered["Other"] = groups["Other"]
    return ordered


def subject_to_bullet(subject: str) -> str:
    """Strip conventional-commit prefix and capitalise."""
    import re
    subject = re.sub(r"^(feat|fix|chore|docs|refactor|test|style|perf|ci|build)"
                     r"(\([^)]+\))?[!]?:\s*", "", subject, flags=re.IGNORECASE)
    return subject[0].upper() + subject[1:] if subject else subject


def build_doc(groups: dict[str, list[str]], days: int, commit_count: int) -> Document:
    doc = Document()
    for section in doc.sections:
        section.top_margin    = Inches(0.6)
        section.bottom_margin = Inches(0.5)
        section.left_margin   = Inches(0.7)
        section.right_margin  = Inches(0.7)

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("ARTES Platform — Weekly Changelog")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = NAVY
    title.space_after = Pt(2)

    # Subtitle
    today      = date.today()
    week_start = (today - timedelta(days=days)).isoformat()
    subtitle   = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(
        f"Week of {week_start} → {today.isoformat()} · {commit_count} commit{'s' if commit_count != 1 else ''}"
    )
    run.font.size = Pt(10)
    run.font.color.rgb = GREY
    subtitle.space_after = Pt(14)

    if not groups:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run("No changes this week.").font.size = Pt(11)
    else:
        for heading_text, subjects in groups.items():
            h = doc.add_paragraph()
            h.style = doc.styles["Heading 2"]
            h.space_before = Pt(8)
            h.space_after  = Pt(3)
            run = h.add_run(heading_text)
            run.font.size = Pt(11)
            run.bold = True
            for r in h.runs:
                r.font.color.rgb = NAVY

            for subject in subjects:
                p = doc.add_paragraph(style="List Bullet")
                p.space_before = Pt(1)
                p.space_after  = Pt(1)
                run = p.add_run(subject_to_bullet(subject))
                run.font.size = Pt(9)

    # Footer
    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.space_before = Pt(14)
    run = footer.add_run(
        "HeadSoft Technology × Helena Coaching · artes.helenacoaching.com"
    )
    run.font.size = Pt(8)
    run.font.color.rgb = LGREY

    return doc


def main():
    parser = argparse.ArgumentParser(description="Generate ARTES weekly changelog")
    parser.add_argument("--days", type=int, default=7, help="How many days back to include (default: 7)")
    args = parser.parse_args()

    commits = get_commits(args.days)
    groups  = group_commits(commits)
    doc     = build_doc(groups, args.days, len(commits))

    out = f"docs/changelog_{date.today().isoformat()}.docx"
    doc.save(out)
    print(f"Saved: {out} ({len(commits)} commits, {len(groups)} sections)")


if __name__ == "__main__":
    main()
