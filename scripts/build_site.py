from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import json
import os
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
ROOT_FILES = [
    "index.html", "style.css", "features.css", "app.js", "app-loader.js",
    "manifest.webmanifest", "sw.js", "icon.svg", ".nojekyll", "404.html",
    "robots.txt", "sitemap.xml",
]
ROOT_GLOBS = ["app-v2.*.part"]
DIRECTORIES = [
    "shared",
    "portal",
    "schedule-studio",
    "appointment-generator",
    "self-training-checklist",
]


def copy_site() -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    for name in ROOT_FILES:
        source = ROOT / name
        if not source.exists():
            raise FileNotFoundError(f"Required build file missing: {name}")
        shutil.copy2(source, OUTPUT / name)
    for pattern in ROOT_GLOBS:
        matches = sorted(ROOT.glob(pattern))
        if not matches:
            raise FileNotFoundError(f"Required build pattern has no files: {pattern}")
        for source in matches:
            shutil.copy2(source, OUTPUT / source.name)
    for name in DIRECTORIES:
        source = ROOT / name
        if not source.exists():
            raise FileNotFoundError(f"Required build directory missing: {name}")
        shutil.copytree(source, OUTPUT / name)


def inject_project_shell() -> None:
    for html_path in OUTPUT.rglob("*.html"):
        if html_path.name == "404.html":
            continue
        content = html_path.read_text(encoding="utf-8")
        if "project-shell.js" in content:
            continue
        depth = len(html_path.relative_to(OUTPUT).parents) - 1
        prefix = "../" * depth
        script = f'  <script src="{prefix}shared/project-shell.js"></script>\n'
        if "</body>" not in content:
            raise ValueError(f"Missing </body> in {html_path.relative_to(OUTPUT)}")
        content = content.replace("</body>", f"{script}</body>")
        content = content.replace(
            'content="width=device-width, initial-scale=1"',
            'content="width=device-width, initial-scale=1, viewport-fit=cover"',
        )
        html_path.write_text(content, encoding="utf-8")


def inject_schedule_extensions() -> None:
    html_path = OUTPUT / "schedule-studio" / "index.html"
    required = [
        OUTPUT / "schedule-studio" / "date-export-loader.js",
        OUTPUT / "schedule-studio" / "date-export.css",
        *[OUTPUT / "schedule-studio" / f"date-export.{index:02d}.part" for index in range(1, 5)],
        OUTPUT / "schedule-studio" / "child-three-day.js",
        OUTPUT / "schedule-studio" / "child-three-day.css",
    ]
    for path in required:
        if not path.exists():
            raise FileNotFoundError(f"Required schedule extension missing: {path.relative_to(OUTPUT)}")
    content = html_path.read_text(encoding="utf-8")
    scripts: list[str] = []
    if "date-export-loader.js" not in content:
        scripts.append('  <script src="date-export-loader.js"></script>')
    if "child-three-day.js" not in content:
        scripts.append('  <script src="child-three-day.js"></script>')
    if scripts:
        content = content.replace("</body>", "\n".join(scripts) + "\n</body>")
        html_path.write_text(content, encoding="utf-8")


def write_build_info() -> None:
    info = {
        "sha": os.getenv("GITHUB_SHA", "local-build"),
        "ref": os.getenv("GITHUB_REF_NAME", "local"),
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "applications": [
            "lifeline",
            "portal",
            "schedule-studio",
            "appointment-generator",
            "self-training-checklist",
        ],
    }
    (OUTPUT / "build-info.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    copy_site()
    inject_project_shell()
    inject_schedule_extensions()
    write_build_info()
    print(f"Built Lifeline site at {OUTPUT}")


if __name__ == "__main__":
    main()
