#!/usr/bin/env python3
"""
Parse a Betterment quarterly activity PDF and extract deposits.

Finds all transactions where Transaction type contains "deposit",
sums the Change: Value column across all fund rows, outputs one row per deposit.

Usage:
    python3 scripts/parse-betterment-pdf.py statement.pdf
    python3 scripts/parse-betterment-pdf.py statement.pdf --output contributions.csv
    python3 scripts/parse-betterment-pdf.py statement.pdf --debug

Requires: pip install pdfplumber
"""

import argparse
import csv
import re
import sys
from datetime import datetime

try:
    import pdfplumber
except ImportError:
    print("Missing dependency: pip install pdfplumber")
    sys.exit(1)

DATE_RE = re.compile(
    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{4}$", re.I
)
TICKER_RE = re.compile(r"^[A-Z]{2,6}$")


def parse_amount(val: str) -> float | None:
    cleaned = re.sub(r"[$,\s]", "", val or "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_date(val: str) -> str | None:
    for fmt in ("%b %d %Y", "%B %d %Y", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(val.strip(), fmt).strftime("%m/%d/%Y")
        except ValueError:
            continue
    return None


def is_dollar(s: str) -> bool:
    return bool(re.match(r"^-?\$[\d,]+\.\d{2}$", s))


def get_page_rows(page) -> list[list[str]]:
    """
    Reconstruct table rows from word positions.
    Groups words by y-coordinate (±3px), sorts each group left→right.
    Returns list of rows, each row being a list of word strings.
    """
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if not words:
        return []

    by_y: dict[int, list] = {}
    for w in words:
        y = round(w["top"])
        # Merge into existing y bucket if within 3px
        matched = next((k for k in by_y if abs(k - y) <= 3), None)
        key = matched if matched is not None else y
        by_y.setdefault(key, []).append(w)

    rows = []
    for y in sorted(by_y):
        word_list = sorted(by_y[y], key=lambda w: w["x0"])
        rows.append([w["text"] for w in word_list])

    return rows


def extract_deposits(pdf_path: str, debug: bool = False) -> list[dict]:
    deposits = []
    current_date = None
    current_type = None
    current_total = 0.0
    is_deposit = False
    in_activity = False
    date_first = True  # True = old format (Date|Transaction), False = new format (Transaction|Date)

    def flush():
        nonlocal current_total, is_deposit
        if is_deposit and current_date and current_total != 0:
            deposits.append({
                "date": current_date,
                "amount": round(current_total, 2),
                "transaction_type": current_type,
                "note": f"Betterment – {current_type}",
            })
        current_total = 0.0
        is_deposit = False

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            rows = get_page_rows(page)
            for words in rows:
                if not words:
                    continue

                if debug:
                    print(f"  p{page_num}: {words}", file=sys.stderr)

                words_upper = [w.upper() for w in words]

                # Detect activity section start/end
                if "QUARTERLY" in words_upper and "ACTIVITY" in words_upper:
                    in_activity = True
                    date_first = True  # reset; overridden by column header row below
                    continue
                if "MONTHLY" in words_upper and "ACTIVITY" in words_upper and "DETAIL" in words_upper:
                    in_activity = True
                    date_first = False
                    continue
                if "CASH" in words_upper and "ACTIVITY" in words_upper:
                    flush()
                    in_activity = False
                    continue

                if not in_activity:
                    continue

                # Detect column order from header row
                if words[0] in ("Date", "Date 1", "Date 2", "Date 3"):
                    date_first = True
                    continue
                if words[0].startswith("Transaction"):
                    date_first = False
                    continue
                if set(words) <= {"Change", "Balance", "Shares", "Value", "Price",
                                  "Transaction", "Portfolio/Fund", "Fund"}:
                    continue

                # --- Detect new transaction group ---
                date_str = None
                new_type = None

                if date_first:
                    # Old format: date at start of row
                    for n in (3, 2, 1):
                        candidate = " ".join(words[:n])
                        if DATE_RE.match(candidate):
                            date_str = candidate
                            remaining = words[n:]
                            fund_idx = next(
                                (i for i, w in enumerate(remaining)
                                 if w in ("Stocks", "Bonds", "Cash")
                                 or TICKER_RE.match(w)
                                 or w.startswith("$")),
                                None
                            )
                            new_type = " ".join(
                                remaining[:fund_idx] if fund_idx is not None else remaining
                            ).strip()
                            break
                else:
                    # New format: Transaction | Date | Fund
                    # Continuation rows start with a date — fall through to dollar extraction
                    starts_with_date = any(
                        DATE_RE.match(" ".join(words[:n]))
                        for n in (3, 2, 1)
                        if n <= len(words)
                    )
                    if not starts_with_date:
                        # New transaction: find date embedded after transaction words
                        for start in range(1, min(8, len(words))):
                            for n in (3, 2, 1):
                                if start + n > len(words):
                                    continue
                                if DATE_RE.match(" ".join(words[start:start + n])):
                                    date_str = " ".join(words[start:start + n])
                                    type_words = words[:start]
                                    ticker_idx = next(
                                        (i for i, w in enumerate(type_words)
                                         if TICKER_RE.match(w) or w.startswith("$")),
                                        None
                                    )
                                    new_type = " ".join(
                                        type_words[:ticker_idx] if ticker_idx is not None else type_words
                                    ).strip()
                                    break
                            if date_str:
                                break

                if date_str and new_type is not None:
                    new_date = parse_date(date_str)
                    if not (new_date == current_date and new_type == current_type):
                        flush()
                        current_date = new_date
                        current_type = new_type
                        current_total = 0.0
                        is_deposit = "deposit" in new_type.lower() or "withdrawal" in new_type.lower()

                if not is_deposit or not current_date:
                    continue

                # --- Extract Change:Value ---
                # Dollar amounts on fund rows (x order): Price, Change:Value, Balance:Value
                dollar_words = [w for w in words if is_dollar(w)]
                if len(dollar_words) >= 2:
                    amt = parse_amount(dollar_words[1])
                    if amt is not None:
                        current_total += amt

    flush()
    return deposits


def main():
    parser = argparse.ArgumentParser(
        description="Extract deposits from a Betterment PDF statement"
    )
    parser.add_argument("pdf", help="Path to Betterment PDF statement")
    parser.add_argument("--output", "-o", help="Output CSV path (default: stdout)")
    parser.add_argument("--debug", action="store_true", help="Print word rows per page")
    args = parser.parse_args()

    print(f"Parsing {args.pdf}...", file=sys.stderr)
    deposits = extract_deposits(args.pdf, debug=args.debug)
    print(f"Found {len(deposits)} deposit transactions", file=sys.stderr)

    if not deposits:
        print("No deposits found. Try --debug to inspect parsed rows.", file=sys.stderr)
        sys.exit(1)

    for d in deposits:
        print(f"  {d['transaction_type']:<40}  {d['date']}  ${d['amount']:>10,.2f}", file=sys.stderr)

    if args.output:
        fieldnames = ["transaction_type", "date", "amount", "note"]
        with open(args.output, "w", newline="") as out:
            writer = csv.DictWriter(out, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(deposits)
        print(f"Written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
