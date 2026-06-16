#!/usr/bin/env python3
"""
Parse Wealthfront monthly statement PDFs and extract contributions and year-end balance.

Usage:
    python3 scripts/parse-wealthfront-statements.py ~/Downloads/STATEMENT_2019-*.pdf

Requires: pip install pdfplumber
"""

import argparse
import re
import sys
from datetime import datetime

try:
    import pdfplumber
except ImportError:
    print("Missing dependency: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

DATE_RE   = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")
AMOUNT_RE = re.compile(r"^\$[\d,]+\.\d{2}$")


def parse_amount(s: str) -> float:
    return float(re.sub(r"[$,]", "", s))


def parse_date(s: str) -> str:
    return datetime.strptime(s.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")


def parse_statement(path: str) -> dict:
    """Returns { ending_balance, period_end, transactions: [{date, amount, kind}] }"""
    ending_balance = None
    period_end = None
    transactions = []

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.split("\n") if l.strip()]

            # Account Summary: find Ending Balance
            for i, line in enumerate(lines):
                if line.startswith("Ending Balance"):
                    # Amount may be on same line or next
                    rest = line[len("Ending Balance"):].strip()
                    if AMOUNT_RE.match(rest):
                        ending_balance = parse_amount(rest)
                    elif i + 1 < len(lines) and AMOUNT_RE.match(lines[i + 1]):
                        ending_balance = parse_amount(lines[i + 1])

                # Period end date (e.g. "December 31, 2019" or "February 28, 2019")
                m = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}", line)
                if m and "Ending Balance" in (lines[i - 1] if i > 0 else "") or \
                   (m and period_end is None and re.search(r"\d{4}$", line)):
                    try:
                        period_end = datetime.strptime(m.group(0), "%B %d, %Y").strftime("%Y-%m-%d")
                    except ValueError:
                        pass

            # Account Activity: parse DEPOSITS / WITHDRAWALS
            # Handles both old ("DEPOSITS") and new ("Deposits to Wealthfront Brokerage") headers
            in_deposits = False
            in_withdrawals = False
            for line in lines:
                lu = line.upper()
                if lu == "DEPOSITS" or lu.startswith("DEPOSITS TO "):
                    in_deposits = True
                    in_withdrawals = False
                    continue
                if lu == "WITHDRAWALS" or lu.startswith("WITHDRAWALS FROM "):
                    in_withdrawals = True
                    in_deposits = False
                    continue
                if lu in ("FEES", "DIVIDENDS", "INTEREST", "OTHER"):
                    in_deposits = False
                    in_withdrawals = False
                    continue

                parts = line.split()
                if len(parts) < 2:
                    continue
                # Skip header and total lines
                if parts[0] in ("Date", "Total", "--"):
                    continue

                if (in_deposits or in_withdrawals) and DATE_RE.match(parts[0]) and AMOUNT_RE.match(parts[-1]):
                    amount = parse_amount(parts[-1])
                    if amount == 0:
                        continue
                    date_str = parse_date(parts[0])
                    kind = "deposit" if in_deposits else "withdrawal"
                    transactions.append({"date": date_str, "amount": amount if kind == "deposit" else -amount, "kind": kind})

    return {"ending_balance": ending_balance, "period_end": period_end, "transactions": transactions}


def main():
    parser = argparse.ArgumentParser(description="Parse Wealthfront monthly PDFs")
    parser.add_argument("pdfs", nargs="+", help="PDF paths (glob-expanded by shell)")
    args = parser.parse_args()

    paths = sorted(args.pdfs)
    all_transactions = []
    last_ending_balance = None
    last_period_end = None

    for path in paths:
        result = parse_statement(path)
        all_transactions.extend(result["transactions"])
        if result["ending_balance"] is not None:
            last_ending_balance = result["ending_balance"]
            last_period_end = result["period_end"]
        print(f"  {path.split('/')[-1][:20]}  ending={result['ending_balance']:>10,.2f}  txns={len(result['transactions'])}", file=sys.stderr)

    all_transactions.sort(key=lambda t: t["date"])

    print(f"\nContributions / Withdrawals ({len(all_transactions)} total):")
    print(f"  {'Date':<12}  {'Kind':<12}  {'Amount':>10}")
    print(f"  {'-'*12}  {'-'*12}  {'-'*10}")
    net = 0.0
    for t in all_transactions:
        sign = "+" if t["amount"] >= 0 else ""
        print(f"  {t['date']:<12}  {t['kind']:<12}  {sign}{t['amount']:>10,.2f}")
        net += t["amount"]

    print(f"\n  Net contributions:  ${net:>10,.2f}")
    print(f"\nYear-end balance ({last_period_end}):  ${last_ending_balance:>10,.2f}")


if __name__ == "__main__":
    main()
