#!/usr/bin/env python3
"""
Stitch multiple PDF files into one PDF.

Usage:
    python3 scripts/stitch-pdfs.py combined.pdf first.pdf second.pdf
    python3 scripts/stitch-pdfs.py combined.pdf "statements/*.pdf" --sort natural
    python3 scripts/stitch-pdfs.py combined.pdf *.pdf --bookmark-by-file --overwrite

Uses pypdf when installed. On macOS, falls back to CoreGraphics for basic merging.
Install pypdf for bookmark support or non-macOS systems: pip install pypdf
"""

import argparse
import glob
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any


def load_pypdf_classes() -> tuple[Any, Any]:
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        try:
            from PyPDF2 import PdfReader, PdfWriter
        except ImportError:
            raise ImportError("Missing dependency: pip install pypdf") from None

    return PdfReader, PdfWriter


def load_coregraphics_functions() -> tuple[Any, ...]:
    try:
        from Quartz import (
            CFURLCreateWithFileSystemPath,
            CGPDFContextClose,
            CGPDFContextCreateWithURL,
            CGPDFDocumentCreateWithURL,
            CGPDFDocumentGetNumberOfPages,
            CGPDFDocumentGetPage,
            CGPDFDocumentIsEncrypted,
            CGPDFDocumentIsUnlocked,
            CGPDFPageGetBoxRect,
            CGContextBeginPage,
            CGContextDrawPDFPage,
            CGContextEndPage,
            kCFURLPOSIXPathStyle,
            kCGPDFMediaBox,
        )
    except ImportError:
        raise ImportError("Missing dependency: pip install pypdf") from None

    return (
        CFURLCreateWithFileSystemPath,
        CGPDFContextClose,
        CGPDFContextCreateWithURL,
        CGPDFDocumentCreateWithURL,
        CGPDFDocumentGetNumberOfPages,
        CGPDFDocumentGetPage,
        CGPDFDocumentIsEncrypted,
        CGPDFDocumentIsUnlocked,
        CGPDFPageGetBoxRect,
        CGContextBeginPage,
        CGContextDrawPDFPage,
        CGContextEndPage,
        kCFURLPOSIXPathStyle,
        kCGPDFMediaBox,
    )


def natural_key(path: Path) -> list[object]:
    parts = re.split(r"(\d+)", path.name.lower())
    return [int(part) if part.isdigit() else part for part in parts]


def expand_inputs(patterns: list[str]) -> list[Path]:
    paths: list[Path] = []

    for pattern in patterns:
        if glob.has_magic(pattern):
            matches = [Path(match) for match in glob.glob(pattern)]
            if not matches:
                raise ValueError(f"No files matched pattern: {pattern}")
            paths.extend(matches)
        else:
            paths.append(Path(pattern))

    return paths


def add_bookmark(writer: Any, title: str, page_number: int) -> None:
    if hasattr(writer, "add_outline_item"):
        writer.add_outline_item(title, page_number)
        return
    if hasattr(writer, "addBookmark"):
        writer.addBookmark(title, page_number)
        return


def write_pypdf_output(writer: Any, output_path: Path) -> None:
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{output_path.name}.",
        suffix=".tmp",
        dir=str(output_path.parent),
    )

    try:
        with os.fdopen(fd, "wb") as temp_file:
            writer.write(temp_file)
        os.replace(temp_name, output_path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def stitch_with_pypdf(
    input_paths: list[Path],
    output_path: Path,
    *,
    bookmark_by_file: bool = False,
) -> int:
    PdfReader, PdfWriter = load_pypdf_classes()
    writer = PdfWriter()
    total_pages = 0

    for path in input_paths:
        reader = PdfReader(str(path))

        if getattr(reader, "is_encrypted", False):
            decrypt_result = reader.decrypt("")
            if decrypt_result == 0:
                raise ValueError(f"Encrypted PDF requires a password: {path}")

        page_count = len(reader.pages)
        if page_count == 0:
            raise ValueError(f"PDF has no pages: {path}")

        start_page = total_pages

        for page in reader.pages:
            writer.add_page(page)
            total_pages += 1

        if bookmark_by_file:
            add_bookmark(writer, path.stem, start_page)

        print(f"Added {path} ({page_count} pages)", file=sys.stderr)

    write_pypdf_output(writer, output_path)
    return total_pages


def stitch_with_quartz(input_paths: list[Path], output_path: Path) -> int:
    (
        CFURLCreateWithFileSystemPath,
        CGPDFContextClose,
        CGPDFContextCreateWithURL,
        CGPDFDocumentCreateWithURL,
        CGPDFDocumentGetNumberOfPages,
        CGPDFDocumentGetPage,
        CGPDFDocumentIsEncrypted,
        CGPDFDocumentIsUnlocked,
        CGPDFPageGetBoxRect,
        CGContextBeginPage,
        CGContextDrawPDFPage,
        CGContextEndPage,
        kCFURLPOSIXPathStyle,
        kCGPDFMediaBox,
    ) = load_coregraphics_functions()

    total_pages = 0

    fd, temp_name = tempfile.mkstemp(
        prefix=f".{output_path.name}.",
        suffix=".tmp",
        dir=str(output_path.parent),
    )
    os.close(fd)

    try:
        output_url = CFURLCreateWithFileSystemPath(
            None, temp_name, kCFURLPOSIXPathStyle, False
        )
        output_context = CGPDFContextCreateWithURL(output_url, None, None)
        if output_context is None:
            raise OSError(f"Could not write PDF: {output_path}")

        for path in input_paths:
            input_url = CFURLCreateWithFileSystemPath(
                None, str(path.resolve()), kCFURLPOSIXPathStyle, False
            )
            input_doc = CGPDFDocumentCreateWithURL(input_url)
            if input_doc is None:
                raise ValueError(f"Could not read PDF: {path}")
            if (
                CGPDFDocumentIsEncrypted(input_doc)
                and not CGPDFDocumentIsUnlocked(input_doc)
            ):
                raise ValueError(f"Encrypted PDF requires a password: {path}")

            page_count = CGPDFDocumentGetNumberOfPages(input_doc)
            if page_count == 0:
                raise ValueError(f"PDF has no pages: {path}")

            for page_number in range(1, page_count + 1):
                page = CGPDFDocumentGetPage(input_doc, page_number)
                media_box = CGPDFPageGetBoxRect(page, kCGPDFMediaBox)
                CGContextBeginPage(output_context, media_box)
                CGContextDrawPDFPage(output_context, page)
                CGContextEndPage(output_context)
                total_pages += 1

            print(f"Added {path} ({page_count} pages)", file=sys.stderr)

        CGPDFContextClose(output_context)
        output_context = None
        os.replace(temp_name, output_path)
    except Exception:
        try:
            if "output_context" in locals() and output_context is not None:
                CGPDFContextClose(output_context)
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise

    return total_pages


def stitch_pdfs(
    input_paths: list[Path],
    output_path: Path,
    *,
    overwrite: bool = False,
    bookmark_by_file: bool = False,
) -> int:
    resolved_output = output_path.resolve()
    resolved_inputs = [path.resolve() for path in input_paths]

    if len(resolved_inputs) < 2:
        raise ValueError("Provide at least two input PDFs to stitch.")

    if resolved_output in resolved_inputs:
        raise ValueError("Output path must not be one of the input PDFs.")

    if output_path.exists() and not overwrite:
        raise FileExistsError(f"Output already exists: {output_path} (use --overwrite)")

    for path in input_paths:
        if not path.exists():
            raise FileNotFoundError(f"Input does not exist: {path}")
        if not path.is_file():
            raise ValueError(f"Input is not a file: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"Input is not a PDF: {path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if bookmark_by_file:
        return stitch_with_pypdf(input_paths, output_path, bookmark_by_file=True)

    try:
        return stitch_with_pypdf(input_paths, output_path)
    except ImportError:
        return stitch_with_quartz(input_paths, output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Combine multiple PDFs into a single PDF, preserving input order by default."
    )
    parser.add_argument("output", help="Path for the stitched PDF")
    parser.add_argument("inputs", nargs="+", help="Input PDF paths or glob patterns")
    parser.add_argument(
        "--sort",
        choices=("none", "name", "natural", "mtime"),
        default="none",
        help="Sort expanded inputs before stitching (default: none)",
    )
    parser.add_argument(
        "--bookmark-by-file",
        action="store_true",
        help="Add a top-level bookmark at the start of each input PDF",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace the output file if it already exists",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    try:
        input_paths = expand_inputs(args.inputs)

        if args.sort == "name":
            input_paths = sorted(input_paths, key=lambda path: path.name.lower())
        elif args.sort == "natural":
            input_paths = sorted(input_paths, key=natural_key)
        elif args.sort == "mtime":
            input_paths = sorted(input_paths, key=lambda path: path.stat().st_mtime)

        total_pages = stitch_pdfs(
            input_paths,
            Path(args.output),
            overwrite=args.overwrite,
            bookmark_by_file=args.bookmark_by_file,
        )
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Wrote {args.output} ({len(input_paths)} PDFs, {total_pages} pages)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
