from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


def split_text(text: str, max_chars: int, overlap: int) -> list[str]:
    """Split text into overlapping chunks, preferring paragraph/sentence boundaries."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    chunks: list[str] = []
    start = 0

    while start < len(text):
        end = min(start + max_chars, len(text))

        if end < len(text):
            # Prefer a useful break near the end of this chunk.
            search_start = start + int(max_chars * 0.65)
            candidates = [
                text.rfind(". ", search_start, end),
                text.rfind("? ", search_start, end),
                text.rfind("! ", search_start, end),
                text.rfind("; ", search_start, end),
                text.rfind(", ", search_start, end),
                text.rfind(" ", search_start, end),
            ]
            boundary = max(candidates)
            if boundary > start:
                end = boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        # Move forward while retaining some context from the previous chunk.
        next_start = max(start + 1, end - overlap)
        while next_start < len(text) and text[next_start].isspace():
            next_start += 1
        start = next_start

    return chunks


def process_pdf(pdf_path: Path, max_chars: int, overlap: int) -> tuple[Path, int, int]:
    reader = PdfReader(str(pdf_path))
    chunks: list[dict] = []
    empty_pages: list[int] = []

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        if not page_text.strip():
            empty_pages.append(page_number)
            continue

        page_chunks = split_text(page_text, max_chars, overlap)
        for chunk_index, chunk_text in enumerate(page_chunks, start=1):
            chunks.append(
                {
                    "id": f"p{page_number:03d}-c{chunk_index:02d}",
                    "source_file": pdf_path.name,
                    "pdf_page": page_number,
                    "chunk_index": chunk_index,
                    "text": chunk_text,
                }
            )

    result = {
        "source_file": pdf_path.name,
        "page_count": len(reader.pages),
        "chunk_count": len(chunks),
        "pages_without_extractable_text": empty_pages,
        "chunks": chunks,
    }

    output_path = pdf_path.with_name(f"{pdf_path.stem}-chunks.json")
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return output_path, len(reader.pages), len(chunks)


def collect_pdfs(inputs: list[Path], recursive: bool) -> tuple[list[Path], list[str]]:
    pdfs: list[Path] = []
    errors: list[str] = []

    for path in inputs:
        if not path.exists():
            errors.append(f"Not found: {path}")
        elif path.is_file():
            if path.suffix.lower() == ".pdf":
                pdfs.append(path)
            else:
                errors.append(f"Not a PDF: {path}")
        elif path.is_dir():
            matches = path.rglob("*") if recursive else path.iterdir()
            pdfs.extend(p for p in matches if p.is_file() and p.suffix.lower() == ".pdf")

    # Remove duplicate paths while keeping the first occurrence.
    unique_pdfs = list(dict.fromkeys(p.resolve() for p in pdfs))
    return unique_pdfs, errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract and chunk one or more research PDFs."
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        type=Path,
        help="PDF file(s) and/or folder(s) containing PDFs",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=3200,
        help="Maximum approximate characters per chunk (default: 3200)",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=350,
        help="Approximate overlapping characters between chunks (default: 350)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Optional maximum PDF page count (0 means unlimited)",
    )
    parser.add_argument(
        "--no-recursive",
        action="store_true",
        help="Do not search subfolders when an input is a folder",
    )
    args = parser.parse_args()

    if args.max_chars <= 0:
        parser.error("--max-chars must be greater than 0")
    if args.overlap < 0 or args.overlap >= args.max_chars:
        parser.error("--overlap must be at least 0 and less than --max-chars")
    if args.max_pages < 0:
        parser.error("--max-pages cannot be negative")

    pdfs, input_errors = collect_pdfs(args.inputs, recursive=not args.no_recursive)

    for error in input_errors:
        print(f"INPUT ERROR: {error}", file=sys.stderr)

    if not pdfs:
        print("No PDF files found.", file=sys.stderr)
        return 1

    succeeded = 0
    failed = 0

    for pdf_path in pdfs:
        try:
            if args.max_pages:
                reader = PdfReader(str(pdf_path))
                if len(reader.pages) > args.max_pages:
                    raise ValueError(f"PDF has {len(reader.pages)} pages; limit is {args.max_pages}.")
            output_path, page_count, chunk_count = process_pdf(
                pdf_path,
                max_chars=args.max_chars,
                overlap=args.overlap,
            )
            print(
                f"OK: {pdf_path.name} — {page_count} pages, "
                f"{chunk_count} chunks -> {output_path}"
            )
            succeeded += 1
        except Exception as exc:
            print(f"FAILED: {pdf_path} — {exc}", file=sys.stderr)
            failed += 1

    print(f"\nDone. Succeeded: {succeeded}; failed: {failed}.")
    return 1 if failed or input_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
