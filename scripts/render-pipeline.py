#!/usr/bin/env python3
"""
Deterministic Video Render Pipeline
====================================
Single command to render any topic/session.
Same input always produces same output.

Usage:
  python3 scripts/render-pipeline.py --topic api-gateway --session 1
  python3 scripts/render-pipeline.py --topic api-gateway --all
  python3 scripts/render-pipeline.py --topic api-gateway --session 1 --preview
  python3 scripts/render-pipeline.py --list-topics
"""

import argparse
import subprocess
import os
import sys
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DOCS_DIR = Path.home() / "Documents" / "guru-sishya"
OUTPUT_DIR = ROOT / "output"
CONTENT_DIR = Path.home() / "PersonalProject" / "guru-sishya" / "public" / "content"

def run(cmd, timeout=600):
    """Run a command, return exit code."""
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=ROOT, timeout=timeout)
    return result.returncode

def list_topics():
    """List all available topics with session counts."""
    topics = []
    for f in CONTENT_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("plan", {}).get("sessions"):
                    topic = item.get("topic", "unknown")
                    slug = topic.lower().replace(" ", "-").replace("/", "-")
                    slug = "".join(c for c in slug if c.isalnum() or c == "-")
                    sessions = len(item["plan"]["sessions"])
                    topics.append((slug, topic, sessions))
        except Exception:
            continue
    topics.sort(key=lambda x: x[0])
    print(f"\n{'Slug':<45} {'Topic':<45} {'Sessions':>8}")
    print("-" * 100)
    for slug, topic, sessions in topics:
        print(f"{slug:<45} {topic:<45} {sessions:>8}")
    print(f"\nTotal: {len(topics)} topics, {sum(t[2] for t in topics)} sessions")

def render_session(topic, session, preview=False):
    """Render a single session. Returns True on success."""
    print(f"\n{'='*60}")
    print(f"  {topic} — Session {session}")
    print(f"{'='*60}")

    props = OUTPUT_DIR / f"test-props-s{session}.json"
    output_name = f"{topic}-s{session}.mp4"
    output_path = OUTPUT_DIR / output_name
    dest_dir = DOCS_DIR / topic / f"session-{session}" / "long"

    # Step 1: Generate storyboard
    print("\n[1/3] Generating storyboard...")
    code = run(f"npx tsx scripts/render-session.ts {topic} {session}", timeout=3600)
    if code != 0 or not props.exists():
        print(f"  FAILED: No props file generated. Topic may not have session {session}.")
        return False

    # Step 2: Render
    if preview:
        print("\n[2/3] Rendering 30s PREVIEW...")
        code = run(f"npx remotion render src/compositions/index.tsx LongVideo {output_path} --props={props} --frames=150-1050 --concurrency=4", timeout=300)
    else:
        print("\n[2/3] Rendering full video...")
        code = run(f"npx remotion render src/compositions/index.tsx LongVideo {output_path} --props={props} --concurrency=4", timeout=600)

    if code != 0:
        print(f"  FAILED: Render error.")
        return False

    # Step 3: Copy to Documents
    print("\n[3/3] Copying to Documents...")
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / output_name
    subprocess.run(["cp", str(output_path), str(dest_path)])

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"\n  ✓ Done: {dest_path} ({size_mb:.0f} MB)")
    return True

def main():
    parser = argparse.ArgumentParser(description="Deterministic Video Render Pipeline")
    parser.add_argument("--topic", type=str, help="Topic slug (e.g., api-gateway)")
    parser.add_argument("--session", type=int, help="Session number (1-10)")
    parser.add_argument("--all", action="store_true", help="Render all sessions of the topic")
    parser.add_argument("--preview", action="store_true", help="Render 30s preview only")
    parser.add_argument("--list-topics", action="store_true", help="List all available topics")
    parser.add_argument("--max-sessions", type=int, default=10, help="Max sessions to render (default 10)")
    args = parser.parse_args()

    if args.list_topics:
        list_topics()
        return

    if not args.topic:
        parser.print_help()
        return

    if args.all:
        successes = 0
        for s in range(1, args.max_sessions + 1):
            if render_session(args.topic, s, args.preview):
                successes += 1
            else:
                print(f"  Stopping at session {s} (no more sessions or error)")
                break
        print(f"\n{'='*60}")
        print(f"  COMPLETE: {successes} videos rendered for {args.topic}")
        print(f"{'='*60}")
    elif args.session:
        render_session(args.topic, args.session, args.preview)
    else:
        print("Specify --session N or --all")

if __name__ == "__main__":
    main()
