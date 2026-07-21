from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse
import sys

ROOT = Path(__file__).resolve().parents[1]
IGNORE_PREFIXES = ("http://", "https://", "mailto:", "tel:", "line:", "data:", "javascript:", "#")


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if data.get("id"):
            self.ids.append(data["id"] or "")
        for key in ("href", "src"):
            value = data.get(key)
            if value:
                self.refs.append(value)


def validate_html(path: Path) -> list[str]:
    parser = AssetParser()
    parser.feed(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        errors.append(f"{path.relative_to(ROOT)} duplicate ids: {', '.join(duplicates)}")
    for ref in parser.refs:
        if ref.startswith(IGNORE_PREFIXES) or ref.startswith("//") or ref.startswith("/"):
            continue
        clean = unquote(urlparse(ref).path)
        if not clean:
            continue
        target = (path.parent / clean).resolve()
        try:
            target.relative_to(ROOT.resolve())
        except ValueError:
            errors.append(f"{path.relative_to(ROOT)} reference escapes project: {ref}")
            continue
        if clean.endswith("/"):
            target = target / "index.html"
        if not target.exists():
            errors.append(f"{path.relative_to(ROOT)} missing local asset: {ref}")
    return errors


def main() -> int:
    errors: list[str] = []
    html_files = [path for path in ROOT.rglob("*.html") if ".git" not in path.parts and "_site" not in path.parts]
    for path in html_files:
        errors.extend(validate_html(path))
    required = [
        ROOT / "index.html",
        ROOT / "shared/project-shell.js",
        ROOT / "portal/index.html",
        ROOT / "schedule-studio/index.html",
        ROOT / "appointment-generator/index.html",
    ]
    for path in required:
        if not path.exists():
            errors.append(f"required file missing: {path.relative_to(ROOT)}")
    if errors:
        print("Site validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Validated {len(html_files)} HTML files and all local references.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
