#!/usr/bin/env python3
"""Validate rendered Xiaohongshu pages and package publishable files without editing images."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image


def fail(message: str) -> None:
    raise ValueError(message)


def image_files(directory: Path, suffix: str) -> list[Path]:
    if not directory.is_dir():
        fail(f"Missing image directory: {directory}")
    files = sorted(directory.glob(f"*.{suffix}"))
    if not files:
        fail(f"No {suffix.upper()} pages found in {directory}")
    for i, item in enumerate(files, 1):
        if not re.fullmatch(r"\d{2}_[^/\\]+", item.stem):
            fail(f"Page name must start with a two-digit index: {item.name}")
        if item.stem[:2] != f"{i:02d}":
            fail(f"Page numbering must be contiguous from 01: {item.name}")
        if item.is_symlink():
            fail(f"Image must be a regular file, not a symlink: {item}")
        with Image.open(item) as im:
            if im.size != (1440, 1920):
                fail(f"Unexpected page size {im.size} for {item.name}; expected 1440 x 1920")
            expected_format = "JPEG" if suffix == "jpg" else "PNG"
            if im.format != expected_format:
                fail(f"Incorrect image encoding for {item.name}: {im.format}")
            im.verify()
    return files


def read_nonempty(path: Path, label: str) -> str:
    if not path.is_file() or path.is_symlink():
        fail(f"Missing regular {label} file: {path}")
    value = path.read_text(encoding="utf-8-sig").strip()
    if not value:
        fail(f"{label} cannot be empty")
    return value + "\n"


def package(render_dir: Path, caption: Path, sources: Path, output: Path, overwrite: bool) -> dict:
    render_dir = render_dir.resolve(strict=True)
    output = output.absolute()
    if output.is_symlink():
        fail("Output cannot be a symlink")
    if output.suffix.lower() != ".zip":
        fail("Output must end in .zip")
    if output.exists() and not overwrite:
        fail("Output exists; use a new filename or explicitly pass --overwrite")

    jpg = image_files(render_dir / "01_ready_to_post_JPG", "jpg")
    png = image_files(render_dir / "02_lossless_PNG", "png")
    if [p.stem for p in jpg] != [p.stem for p in png]:
        fail("JPG and PNG page names do not match")

    audit_path = render_dir / "layout_audit.json"
    if not audit_path.is_file():
        fail("Missing layout_audit.json; render and check the full set first")
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    if "status" in audit and audit["status"] != "passed":
        fail(f"Render audit status is not passed: {audit['status']}")
    if audit.get("errors"):
        fail("Render audit reports errors")
    if audit.get("pages") != len(jpg):
        fail("Audit page count does not match the image folders")
    if "overflow" not in audit or audit["overflow"] not in ([], 0):
        fail("Layout audit reports overflow or is missing an overflow result")
    audit_files = audit.get("files")
    if not isinstance(audit_files, list) or len(audit_files) != len(jpg):
        fail("Audit must enumerate every rendered page")
    audited_names = []
    for entry in audit_files:
        name = entry if isinstance(entry, str) else entry.get("name", "")
        audited_names.append(Path(str(name)).stem)
    if audited_names != [p.stem for p in jpg]:
        fail("Audit page names differ from the render folder; remove stale output or render afresh")

    overview = render_dir / "overview.png"
    if not overview.is_file() or overview.is_symlink():
        fail("Missing regular overview.png")
    with Image.open(overview) as im:
        if im.format != "PNG" or im.width < 1 or im.height < 1:
            fail("Overview must be a valid PNG")
        im.verify()

    caption_text = read_nonempty(caption, "caption")
    sources_text = read_nonempty(sources, "sources")
    count = len(jpg)
    instructions = (
        f"小红书图文发布包\n\n共 {count} 张独立图片，每张 1440 × 1920 px，3:4 竖版。\n\n"
        f"1. 打开 01_ready_to_post_JPG，按 01 至 {count:02d} 的顺序选择 JPG 上传。\n"
        "2. caption.txt 包含推荐标题、正文与标签，可直接复制使用。\n"
        "3. 02_lossless_PNG 是同版无损图片，可作为备份或继续排版的参考。\n"
        "4. overview.png 用来浏览整套设计；发布时请使用独立图片。\n"
        "5. sources.txt 保留关键事实的出处与核查记录。\n\n"
        "此包已生成供你发布；尚未上传或发布到任何社交账户。\n"
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=".xhs_publish_", suffix=".zip", dir=output.parent, delete=False) as f:
        temporary = Path(f.name)
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED) as archive:
            for folder, files in (("01_ready_to_post_JPG", jpg), ("02_lossless_PNG", png)):
                for item in files:
                    archive.write(item, f"{folder}/{item.name}")
            base = "03_copy_and_sources"
            archive.write(overview, f"{base}/overview.png")
            archive.writestr(f"{base}/caption.txt", caption_text.encode("utf-8"))
            archive.writestr(f"{base}/sources.txt", sources_text.encode("utf-8"))
            archive.writestr(f"{base}/readme.txt", instructions.encode("utf-8"))
        with ZipFile(temporary) as archive:
            corrupt = archive.testzip()
            if corrupt:
                fail(f"ZIP integrity check failed: {corrupt}")
            if len(archive.namelist()) != 2 * count + 4:
                fail("Unexpected archive file count")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)

    return {"output": str(output), "pages": count, "files": count * 2 + 4,
            "page_size": [1440, 1920], "bytes": output.stat().st_size,
            "zip_integrity": "passed", "visual_review": "Required separately; not verified by this script"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render-dir", type=Path, required=True)
    parser.add_argument("--caption", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        result = package(args.render_dir, args.caption, args.sources, args.output, args.overwrite)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        parser.exit(2, f"Publish package validation failed: {error}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
