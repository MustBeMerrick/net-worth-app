#!/usr/bin/env python3
"""
Parse a Robinhood/Apex monthly statement PDF and extract ACH deposits and withdrawals.

Handles two statement formats:
  Old (Apex): ACH rows in "FUNDS PAID AND RECEIVED" section
              ['ACH', 'MM/DD/YY', 'C', 'ACH', 'DEPOSIT', '100.00']
  New (RHS):  ACH rows in "Account Activity" section
              ['ACH', 'Deposit', 'Margin', 'ACH', 'MM/DD/YYYY', '$1,000.00']

Usage:
    python3 scripts/parse-robinhood-pdf.py statement.pdf
    python3 scripts/parse-robinhood-pdf.py statement.pdf --output contributions.csv
    python3 scripts/parse-robinhood-pdf.py statement.pdf --debug

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

DATE_RE_SHORT = re.compile(r"^\d{2}/\d{2}/\d{2}$")   # MM/DD/YY  (old format)
DATE_RE_LONG  = re.compile(r"^\d{2}/\d{2}/\d{4}$")   # MM/DD/YYYY (new format)


def parse_amount(val: str) -> float | None:
    cleaned = re.sub(r"[$,\s]", "", val or "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_date(val: str) -> str | None:
    for fmt in ("%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def get_page_rows(page) -> list[list[str]]:
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if not words:
        return []

    by_y: dict[int, list] = {}
    for w in words:
        y = round(w["top"])
        matched = next((k for k in by_y if abs(k - y) <= 3), None)
        key = matched if matched is not None else y
        by_y.setdefault(key, []).append(w)

    rows = []
    for y in sorted(by_y):
        word_list = sorted(by_y[y], key=lambda w: w["x0"])
        rows.append([w["text"] for w in word_list])
    return rows


def try_parse_old_format(words: list[str]) -> dict | None:
    """
    Old Apex format: ['ACH', 'MM/DD/YY', 'C', 'ACH', 'DEPOSIT/WITHDRAWAL', 'AMOUNT']
    Must be called only within the FUNDS PAID AND RECEIVED section.
    """
    if len(words) < 4 or words[0] != "ACH":
        return None
    if not DATE_RE_SHORT.match(words[1]):
        return None

    date_str = parse_date(words[1])
    if not date_str:
        return None

    amount = parse_amount(words[-1])
    if amount is None or amount == 0:
        return None

    desc_upper = " ".join(words[3:]).upper()
    if "DEPOSIT" in desc_upper:
        return {"date": date_str, "amount": amount, "kind": "ACH Deposit"}
    if "WITHDRAWAL" in desc_upper or "DISBURSEMENT" in desc_upper:
        return {"date": date_str, "amount": -amount, "kind": "ACH Withdrawal"}
    return None


def try_parse_new_format(words: list[str]) -> dict | None:
    """
    New RHS format: ['ACH', 'Deposit'|'Withdrawal', ACCT_TYPE, 'ACH', 'MM/DD/YYYY', '$AMOUNT']
    """
    if len(words) < 6 or words[0] != "ACH":
        return None
    if words[1] not in ("Deposit", "Withdrawal"):
        return None
    if not DATE_RE_LONG.match(words[4]):
        return None

    date_str = parse_date(words[4])
    if not date_str:
        return None

    amount = parse_amount(words[5])
    if amount is None or amount == 0:
        return None

    if words[1] == "Deposit":
        return {"date": date_str, "amount": amount, "kind": "ACH Deposit"}
    else:
        return {"date": date_str, "amount": -amount, "kind": "ACH Withdrawal"}


def extract_transactions(pdf_path: str, debug: bool = False) -> list[dict]:
    transactions = []
    in_funds_section = False

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            rows = get_page_rows(page)
            for words in rows:
                if not words:
                    continue

                if debug:
                    print(f"  p{page_num}: {words}", file=sys.stderr)

                joined = " ".join(words)

                # Track old-format FUNDS section boundaries
                if "FUNDS PAID AND RECEIVED" in joined:
                    in_funds_section = True
                    continue
                if in_funds_section and words[0] == "Total" and "Funds" in words:
                    in_funds_section = False
                    continue

                if words[0] != "ACH":
                    continue

                # New format: works anywhere in the document
                result = try_parse_new_format(words)
                if result:
                    transactions.append(result)
                    continue

                # Old format: only valid inside the FUNDS section
                if in_funds_section:
                    result = try_parse_old_format(words)
                    if result:
                        transactions.append(result)

    return transactions


def main():
    parser = argparse.ArgumentParser(
        description="Extract ACH deposits/withdrawals from a Robinhood PDF statement"
    )
    parser.add_argument("pdf", help="Path to Robinhood PDF statement")
    parser.add_argument("--output", "-o", help="Output CSV path (default: stdout)")
    parser.add_argument("--debug", action="store_true", help="Print word rows per page")
    args = parser.parse_args()

    print(f"Parsing {args.pdf}...", file=sys.stderr)
    transactions = extract_transactions(args.pdf, debug=args.debug)
    print(f"Found {len(transactions)} transactions", file=sys.stderr)

    if not transactions:
        print("No transactions found. Try --debug to inspect parsed rows.", file=sys.stderr)
        sys.exit(1)

    for t in transactions:
        sign = "+" if t["amount"] >= 0 else ""
        print(f"  {t['date']}  {t['kind']:<20}  {sign}${t['amount']:>10,.2f}", file=sys.stderr)

    if args.output:
        fieldnames = ["date", "amount", "transaction_type", "note"]
        rows = [
            {"date": t["date"], "amount": t["amount"], "transaction_type": t["kind"],
             "note": f"Robinhood – {t['kind']}"}
            for t in transactions
        ]
        with open(args.output, "w", newline="") as out:
            writer = csv.DictWriter(out, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
