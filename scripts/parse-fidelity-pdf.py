#!/usr/bin/env python3
"""
Parse Fidelity 401(k) PDF statements (NTESS/Sandia and L3Harris formats) via OCR.

Extracts account-summary balances, per-fund market values, transaction detail,
and contributions by date — and applies each statement's own per-source vested
percentages so employer money is counted at its vested value (e.g. forfeited
contributions show as $0).

Usage:
    python3 scripts/parse-fidelity-pdf.py file1.pdf file2.pdf --stdout
    python3 scripts/parse-fidelity-pdf.py *.pdf --csv -o ./out
    python3 scripts/parse-fidelity-pdf.py *.pdf --csv --stdout

Requires: pip install pandas pytesseract pdf2image
          plus system deps: tesseract, poppler
"""

import os
import re
import sys
import glob
import atexit
import shutil
import tempfile
from pathlib import Path

# pdf2image/pytesseract scratch space. Set TMPDIR before they import, use a
# private temp dir (respects $TMPDIR), and remove it on exit so we never leave
# OCR scratch files behind in the repo.
_TMPDIR = tempfile.mkdtemp(prefix="parse-401k-ocr-")
os.environ["TMPDIR"] = _TMPDIR
atexit.register(lambda: shutil.rmtree(_TMPDIR, ignore_errors=True))

import pandas as pd
import pytesseract
from pdf2image import convert_from_path  # noqa: E402 (needs TMPDIR set first)


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def pdf_to_pages(pdf_path: str, dpi: int = 200) -> list[str]:
    images = convert_from_path(pdf_path, dpi=dpi)
    return [pytesseract.image_to_string(img, config="--psm 6") for img in images]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_dollar(s: str) -> float | None:
    s = str(s).strip().replace("$", "").replace(" ", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse_units(s: str) -> float | None:
    """Parse unit counts (3 decimal places). OCR sometimes outputs comma instead of period."""
    s = str(s).strip()
    # If format is NNN,DDD (comma as decimal separator, 3 dp), convert to NNN.DDD
    m = re.match(r"^(-?\d+),(\d{3})$", s)
    if m:
        s = f"{m.group(1)}.{m.group(2)}"
    return parse_dollar(s)


def parse_price(s: str) -> float | None:
    """Parse a fund price (2 or 6 decimal places).
    OCR variants seen in the wild:
      $26.079585   normal
      $26,079585   comma as decimal separator, no period
      $19,.187685  spurious comma inserted before the decimal
    """
    s = str(s).strip().replace("$", "").replace(" ", "")
    # comma-as-decimal, no period: NN,NNNNNN → NN.NNNNNN
    m = re.match(r"^(-?\d+),(\d{2,6})$", s)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")
    # spurious comma before decimal: NN,.NNNNNN → NN.NNNNNN
    s = re.sub(r",\.", ".", s)
    return parse_dollar(s)


def first_match(pattern: str, text: str, group: int = 1, flags=re.IGNORECASE) -> str | None:
    m = re.search(pattern, text, flags)
    return m.group(group).strip() if m else None


def last_dollar_match(pattern: str, text: str) -> float | None:
    """Find all matches and return the last valid dollar value (avoids garbled OCR on page 1)."""
    matches = re.findall(pattern, text, re.IGNORECASE)
    result = None
    for m in matches:
        v = parse_dollar(m)
        if v is not None and v >= 0:
            result = v
    return result


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------

def detect_type(pages: list[str]) -> str:
    head = "\n".join(pages[:2]).upper()
    if "NTESS" in head or "SANDIA" in head:
        return "sandia"
    if "L3HARRIS" in head or "L3HARRIS" in head or "HARRIS" in head:
        return "l3harris"
    return "unknown"


def detect_period(pages: list[str]) -> tuple[str, str]:
    text = "\n".join(pages[:2])
    # "January 1, 2016 - December 31, 2016"
    months = r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    m = re.search(
        months + r"\s+(\d{1,2}),?\s+(\d{4})\s*[-–]\s*" + months + r"\s+(\d{1,2}),?\s+(\d{4})",
        text, re.IGNORECASE,
    )
    if m:
        mm = {"january":"01","february":"02","march":"03","april":"04","may":"05","june":"06",
              "july":"07","august":"08","september":"09","october":"10","november":"11","december":"12"}
        return (f"{mm[m.group(1).lower()]}/{m.group(2)}/{m.group(3)}",
                f"{mm[m.group(4).lower()]}/{m.group(5)}/{m.group(6)}")
    # "01/01/2016 to 12/31/2016"
    m = re.search(r"(\d{2}/\d{2}/\d{4})\s+to\s+(\d{2}/\d{2}/\d{4})", text)
    if m:
        return m.group(1), m.group(2)
    return "", ""


# ---------------------------------------------------------------------------
# Account Summary
# ---------------------------------------------------------------------------

def _activity_text_no_transactions(pages: list[str]) -> str:
    """
    All Account Summary/Activity text across pages, stopping before
    Transaction Detail sections (to avoid unit columns polluting dollar matches).
    """
    sections = []
    for page in pages:
        # Stop at first occurrence of Transaction Detail on this page
        cutoff = re.search(r"Your\s+Transaction\s+Detail", page, re.IGNORECASE)
        sections.append(page[: cutoff.start()] if cutoff else page)
    return "\n".join(sections)


def parse_summary(pages: list[str]) -> dict:
    """
    Parse account summary values.

    Balance fields use a $ sign required pattern so garbled OCR like '84:'
    (instead of '$29,842.29') is automatically ignored.  We take the last
    properly-formatted match across all pages.

    Contribution/fee fields only need a well-formed number (no $ required).
    """
    activity = _activity_text_no_transactions(pages)
    p1_2 = "\n".join(pages[:2])   # rate-of-return lives on page 1-2

    def grab_dollar_first(pattern):
        """
        Find FIRST $ match across all pages.
        - Garbled OCR on page 1 drops the $ sign, so the first $ match is
          the correct page-3 value for Sandia.
        - For L3Harris, page 1 always has the correct total with $, found first
          before the per-fund breakdown on page 2.
        Allows $0.00 (e.g. fresh/terminated accounts).
        """
        val = first_match(pattern, activity)
        if val is None:
            return None
        v = parse_dollar(val)
        return v  # None or float (including 0.0)

    def grab_num_first(pattern):
        """
        First match of a plain number (no $ required).
        Using first match avoids picking up per-fund breakdown rows on page 2+,
        which repeat the same label (e.g. 'Your Contributions') for each fund.
        The page-1 summary always has the correct total and appears first.
        """
        val = first_match(pattern, activity)
        return parse_dollar(val) if val else None

    def grab_pct(pattern):
        val = first_match(pattern, p1_2)
        return val

    return {
        # $ required — garbled OCR values lack the $, so first $ match is correct total
        "beginning_balance":        grab_dollar_first(r"Beginning\s+Balance\s+(\$[\d,]+\.\d{2})"),
        "ending_balance":           grab_dollar_first(r"Ending\s+Balance\s+(\$[\d,]+\.\d{2})"),
        "vested_balance":           grab_dollar_first(r"Vested\s+Balance\s+(\$[\d,]+\.\d{2})"),
        # First match = page-1 total; later matches are per-fund breakdowns
        "employee_contributions":   grab_num_first(r"Employee\s+Contributions?\s+\$?([\d,]+\.\d{2})"),
        "your_contributions":       grab_num_first(r"Your\s+Contributions?\s+\$?([\d,]+\.\d{2})"),
        "company_match":            grab_num_first(r"Company\s+(?:Match|Contributions?)\s+\$?([\d,]+\.\d{2})"),
        "exchange_in":              grab_num_first(r"Exchange\s+In\s+\$?([\d,]+\.\d{2})"),
        "exchange_out":             grab_num_first(r"Exchange\s+Out\s+\$?(-?[\d,]+\.\d{2})"),
        "fees":                     grab_num_first(r"(?:Administrative\s+)?Fees?\s+\$?(-?[\d,]+\.\d{2})"),
        "investment_gain_loss":     grab_num_first(r"Investment\s+Gain[/\\]Loss\s+\$?(-?[\d,]+\.\d{2})"),
        "change_in_market_value":   grab_num_first(r"Change\s+in\s+Market\s+Value\s+\$?(-?[\d,]+\.\d{2})"),
        "personal_ror_this_period": grab_pct(r"This\s+Period\s+([\d.]+%)"),
        "personal_ror_year_to_date":grab_pct(r"Year\s+to\s+Date\s+([\d.]+%)"),
    }


# ---------------------------------------------------------------------------
# Market Value table
# ---------------------------------------------------------------------------

def _market_value_section(pages: list[str]) -> str:
    """Extract only the Market Value of Your Account table text."""
    sections = []
    for page in pages:
        m = re.search(
            r"Market\s+Value\s+of\s+Your\s+Account(.*?)"
            r"(?:Your\s+(?:Transaction\s+Detail|Contribution\s+Elections|Account\s+Information)|"
            r"A\s+Message\s+From|Additional\s+Fund\s+Information|Account\s+Total|$)",
            page, re.DOTALL | re.IGNORECASE,
        )
        if m:
            sections.append(m.group(0))
    return "\n".join(sections)


def parse_market_value(pages: list[str]) -> list[dict]:
    """
    Parse rows from the 'Market Value of Your Account' table.
    Format (both plan types):
      Fund Name   units_start   units_end   $price_start   $price_end   mktval_start   mktval_end
    Dollar signs on prices are sometimes absent in OCR.
    """
    text = _market_value_section(pages)
    rows = []

    # Unit patterns: normal (NNN.DDD) or OCR-comma decimal (NNN,DDD)
    unit_pat = r"(\d+[.,]\d{3})"
    # Price patterns: 2-6 decimal places
    price_pat = r"\$?([\d,]+\.\d{2,6})"
    # Market value: 2 decimal places, may start with "0,00" (OCR comma) or "$0.00"
    mval_pat = r"\$?([\d,]+[.,]\d{2})"

    pattern = re.compile(
        r"^(.{4,50}?)\s+"    # fund name
        + unit_pat + r"\s+"  # units_start
        + unit_pat + r"\s+"  # units_end
        + price_pat + r"\s+" # price_start
        + price_pat + r"\s+" # price_end
        + mval_pat + r"\s+"  # mktval_start
        + mval_pat,          # mktval_end
        re.MULTILINE,
    )
    seen = set()
    for m in pattern.finditer(text):
        fund = m.group(1).strip()
        # Skip header lines
        if re.search(r"\b(units|price|value|invest|date)\b", fund, re.IGNORECASE):
            continue
        key = (fund, m.group(2), m.group(3))
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "investment":          fund,
            "units_start":         parse_units(m.group(2)),
            "units_end":           parse_units(m.group(3)),
            "price_start":         parse_dollar(m.group(4)),
            "price_end":           parse_dollar(m.group(5)),
            "market_value_start":  parse_dollar(m.group(6)),
            "market_value_end":    parse_dollar(m.group(7)),
        })

    # Also grab summary-level rows with no units (just two dollar values on a line)
    # e.g. "Blended Fund Investments*  $12,419.22  $29,842.29"
    if not rows:
        simple = re.compile(
            r"^(.{4,50}?)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s*$",
            re.MULTILINE,
        )
        for m in simple.finditer(text):
            fund = m.group(1).strip()
            if re.search(r"\b(units|price|value|invest|date)\b", fund, re.IGNORECASE):
                continue
            rows.append({
                "investment":         fund,
                "units_start":        None,
                "units_end":          None,
                "price_start":        None,
                "price_end":          None,
                "market_value_start": parse_dollar(m.group(2)),
                "market_value_end":   parse_dollar(m.group(3)),
            })

    return rows


# ---------------------------------------------------------------------------
# Transaction detail
# ---------------------------------------------------------------------------

_KNOWN_SOURCES = (
    r"Pre-Tax|Company Match|Enhanced Contribution|Roth(?:\s+\d{3,4}k)?|"
    r"After-Tax|Rollover|Employer|Employee|Traditional"
)


def parse_transactions(pages: list[str]) -> list[dict]:
    """
    Parse per-transaction rows from the 'Transaction Detail' section.

    Both plan types use:
      MM/DD/YYYY  <Type>  <Source>  [units  price]  amount

    Known sources are anchored (Pre-Tax, Company Match, Enhanced Contribution, etc.)
    so that multi-word types like "Realized G/L" or "Recordkeeping Fee" parse correctly.
    Fund name appears as a heading line before its transactions.
    """
    rows = []
    current_fund = None

    # Allow leading OCR margin noise (e.g. "= ", "s ", "me ") before a date or fund name
    noise_re    = re.compile(r"^[^A-Za-z0-9]*")          # non-alnum prefix
    date_re     = re.compile(r"(\d{2}/\d{2}/\d{4})\s+(.+)$")
    artifact_re = re.compile(r"^['\"\`\s]+")

    # Anchor on known source names to split type from the rest
    source_anchor = re.compile(
        r"^(.+?)\s+(" + _KNOWN_SOURCES + r")\s+"  # type then source
        r"(?:[A-Za-z]{1,4}\s+)?"                   # optional short OCR noise token before units
        r"(-?[\d,]+[.,]\d+[,:]?)\s+"               # units (period or comma as decimal; optional trailing , or :)
        r"\$?([\d,]+[.,]\d{2,6})\s+"               # price (period or comma as decimal)
        r"\$?(-?[\d,.\(\)]+)$",                    # amount
        re.IGNORECASE,
    )
    source_anchor_no_units = re.compile(
        r"^(.+?)\s+(" + _KNOWN_SOURCES + r")\s+"  # type then source
        r"\$?(-?[\d,.\(\)]+)$",                   # amount only
        re.IGNORECASE,
    )

    for page in pages:
        for line in page.splitlines():
            line = line.rstrip()
            # Strip leading OCR noise to get the meaningful content
            clean = noise_re.sub("", line).strip()

            fund_candidate = re.match(
                r"^([A-Z][A-Za-z &/\-0-9]+(?:Fund|Index|Growth|Value|Blend|Income|Equity|"
                r"Bond|Target|International|Cap|Completion|Strat|BTC|Small|Large|Foreign|"
                r"Vanguard|Fidelity|PIMCO|Schwab|Stable)[A-Za-z &/\-0-9]*)$",
                clean,
            )
            if fund_candidate:
                current_fund = fund_candidate.group(1).strip()
                continue

            m = date_re.search(clean)
            if not m:
                continue

            date = m.group(1)
            rest = artifact_re.sub("", m.group(2)).strip()

            txn_type = source = units = price = amount = None

            fm = source_anchor.match(rest)
            if fm:
                txn_type = fm.group(1).strip()
                source   = fm.group(2).strip()
                units    = parse_units(fm.group(3))
                price    = parse_price(fm.group(4))
                amount   = parse_dollar(fm.group(5))
            else:
                sm = source_anchor_no_units.match(rest)
                if sm:
                    txn_type = sm.group(1).strip()
                    source   = sm.group(2).strip()
                    amount   = parse_dollar(sm.group(3))
                else:
                    txn_type = rest  # fallback — store raw

            if amount is None:
                continue

            rows.append({
                "trade_date":       date,
                "fund":             current_fund or "",
                "transaction_type": txn_type or "",
                "source":           source or "",
                "units":            units,
                "price":            price,
                "amount":           amount,
            })

    return rows


# ---------------------------------------------------------------------------
# Contribution elections
# ---------------------------------------------------------------------------

def parse_contribution_elections(pages: list[str]) -> list[dict]:
    """Extract fund allocation % from Contribution Elections section."""
    text = "\n".join(pages)
    rows = []
    in_section = False
    for line in text.splitlines():
        if re.search(r"Contribution\s+Elections?", line, re.IGNORECASE):
            in_section = True
        if not in_section:
            continue
        # Stop at next major section
        if in_section and re.search(r"Transaction\s+Detail|Account\s+Activity|Market\s+Value", line, re.IGNORECASE):
            break
        m = re.match(r"^([A-Za-z][A-Za-z &/\-0-9]{3,}?)\s+((?:\d{1,3}%\s*)+)$", line.strip())
        if m:
            fund = m.group(1).strip()
            pcts = re.findall(r"\d{1,3}%", m.group(2))
            rows.append({"fund": fund, "percentages": " / ".join(pcts)})
    return rows


# ---------------------------------------------------------------------------
# Vesting
# ---------------------------------------------------------------------------

def _norm_source(tok: str) -> str | None:
    """Map a Contribution-Summary header token to a canonical source name."""
    t = tok.strip().strip("—-_").lower()
    if t.startswith("pre-tax") or t == "pretax":   return "Pre-Tax"
    if t == "match":                                return "Company Match"
    if t == "rollover":                             return "Rollover"
    if t == "contribution":                         return "Enhanced Contribution"
    if t.startswith("roth"):                        return "Roth"
    if t.startswith("after"):                       return "After-Tax"
    return None


def parse_vested_percent(pages: list[str], stmt_type: str) -> dict:
    """
    Return {source_name: vested_fraction} from the statement itself.

    Sandia/NTESS prints a per-source 'Vested Percent' row inside the
    'Contribution Summary' table (e.g. Enhanced Contribution 0.00, all others
    100.00).  L3Harris has no such row, so the vested fraction is only
    observable at termination from the Withdrawals (vested $ that rolled out)
    vs. Forfeitures (unvested $) split in the by-source activity table.

    Employee money (Pre-Tax/Roth/After-Tax) and Rollover money are always
    100% vested and are filled in by _vested_fraction() if absent here.
    """
    text = "\n".join(pages)

    if stmt_type == "sandia":
        sources, pcts = None, None
        for ln in text.splitlines():
            m = re.search(r"Contribution\s+Summary\s+(.+)$", ln, re.IGNORECASE)
            if m:
                sources = [_norm_source(t) for t in m.group(1).split()]
            if re.search(r"Vested\s+Percent", ln, re.IGNORECASE):
                pcts = [float(n.replace(",", "."))
                        for n in re.findall(r"\d+(?:[.,]\d+)?", ln)]
        out = {}
        if sources and pcts:
            for src, pc in zip(sources, pcts):   # positional alignment
                if src is not None:
                    out[src] = pc / 100.0
        return out

    if stmt_type == "l3harris":
        # By-source activity table has 3 columns: Pre-Tax | Match | Total.
        def three_col(label):
            for ln in text.splitlines():
                if re.match(rf"^\s*{label}\b", ln, re.IGNORECASE):
                    nums = re.findall(r"-?[\d,]+\.\d{2}", ln)
                    if len(nums) == 3:           # the by-source summary row
                        return [abs(float(n.replace(",", ""))) for n in nums]
            return None
        out = {"Pre-Tax": 1.0}
        withdrawn, forfeited = three_col("Withdrawals"), three_col("Forfeitures")
        if withdrawn and forfeited:
            vested_match, unvested_match = withdrawn[1], forfeited[1]  # Match column
            if vested_match + unvested_match > 0:
                out["Company Match"] = round(
                    vested_match / (vested_match + unvested_match), 4)
        return out

    return {}


def _vested_fraction(source: str | None, vested_pct: dict) -> float:
    """Resolve a source's vested fraction, defaulting employee/rollover money to 100%."""
    if not source:
        return 1.0
    s = source.strip().lower()
    for k, v in vested_pct.items():
        if k.lower() == s:
            return v
    if _EMPLOYEE_SOURCES.search(source) or re.search(r"rollover", source, re.IGNORECASE):
        return 1.0
    return 1.0   # employer source with no reported %: assume fully vested


# ---------------------------------------------------------------------------
# Top-level parser
# ---------------------------------------------------------------------------

def parse_pdf(pdf_path: str) -> dict:
    path = Path(pdf_path)
    print(f"  Processing {path.name} ...")
    pages = pdf_to_pages(pdf_path)
    stmt_type = detect_type(pages)
    period_start, period_end = detect_period(pages)
    print(f"    Type={stmt_type}  Period={period_start} to {period_end}  Pages={len(pages)}")
    return {
        "file":           path.name,
        "statement_type": stmt_type,
        "period_start":   period_start,
        "period_end":     period_end,
        "summary":        parse_summary(pages),
        "market_value":   parse_market_value(pages),
        "transactions":   parse_transactions(pages),
        "contribution_elections": parse_contribution_elections(pages),
        "vested_pct":     parse_vested_percent(pages, stmt_type),
        "_raw_pages":     pages,
    }


def build_contributions_summary(results: list[dict]) -> pd.DataFrame:
    """
    For each statement period, sum contributions by date and include
    the beginning balance (Jan 1 / period start) and ending balance (Dec 31 / period end).
    """
    rows = []
    empty_row = {"trade_date": None, "contribution_type": None, "total_amount": None,
                 "vested_percent": None, "vested_amount": None, "num_transactions": 0}
    for r in results:
        meta = {
            "file":           r["file"],
            "statement_type": r["statement_type"],
            "period_start":   r["period_start"],
            "period_end":     r["period_end"],
            "beginning_balance": r["summary"].get("beginning_balance"),
            "ending_balance":    r["summary"].get("ending_balance"),
        }
        vested_pct = r.get("vested_pct", {})
        txns = r["transactions"]
        if not txns:
            rows.append({**meta, **empty_row})
            continue

        df = pd.DataFrame(txns)
        # Contributions only
        contrib_mask = df["transaction_type"].str.contains(
            r"contribution", case=False, na=False
        )
        contrib_df = df[contrib_mask].copy()
        if contrib_df.empty:
            rows.append({**meta, **empty_row})
            continue

        # Group by date and source (Pre-Tax, Company Match, Enhanced Contribution, etc.)
        for (date, src), grp in contrib_df.groupby(["trade_date", "source"], sort=True, dropna=False):
            gross = round(grp["amount"].sum(), 2)
            frac  = _vested_fraction(src, vested_pct)
            rows.append({
                **meta,
                "trade_date":       date,
                "contribution_type": src,
                "total_amount":      gross,
                "vested_percent":    round(frac * 100, 2),
                "vested_amount":     round(gross * frac, 2),
                "num_transactions":  len(grp),
            })
    return pd.DataFrame(rows)


def build_contribution_totals(contrib_df: pd.DataFrame) -> pd.DataFrame:
    """
    Roll the per-date contribution detail up to one row per (file, source) with
    gross contributed, vested %, and vested $ — plus employee/employer kind.
    This is the spreadsheet-ready 'vested amounts' summary.
    """
    rows = []
    if contrib_df.empty:
        return pd.DataFrame(rows)
    d = contrib_df.dropna(subset=["total_amount"])
    keys = ["file", "period_start", "period_end", "contribution_type"]
    for (file, ps, pe, src), grp in d.groupby(keys, sort=True, dropna=False):
        gross  = round(grp["total_amount"].sum(), 2)
        vested = round(grp["vested_amount"].sum(), 2)
        src_s  = str(src)
        if _EMPLOYER_SOURCES.search(src_s):
            kind = "employer"
        elif _EMPLOYEE_SOURCES.search(src_s):
            kind = "employee"
        else:
            kind = "other"
        rows.append({
            "file":           file,
            "period_start":   ps,
            "period_end":     pe,
            "kind":           kind,
            "source":         src,
            "gross":          gross,
            "vested_percent": round(100 * vested / gross, 2) if gross else None,
            "vested":         vested,
        })
    return pd.DataFrame(rows)



# Sources that count as employee contributions vs. employer contributions
_EMPLOYEE_SOURCES = re.compile(r"pre.?tax|roth|after.?tax|traditional", re.IGNORECASE)
_EMPLOYER_SOURCES = re.compile(r"company\s+match|enhanced\s+contribution|employer", re.IGNORECASE)


def _check_one(label: str, stated: float | None,
               txn_df: pd.DataFrame, source_filter: re.Pattern) -> dict:
    """Compare a stated summary dollar against the sum of matching transaction rows."""
    contrib = txn_df[txn_df["transaction_type"].str.contains(r"contribution", case=False, na=False)]
    parsed = round(contrib.loc[contrib["source"].str.contains(source_filter, na=False), "amount"].sum(), 2)
    stated_r = round(stated, 2) if stated is not None else None

    if stated_r is None:
        status, delta = "NO SUMMARY VALUE", None
    elif abs(parsed - stated_r) < 0.02:
        status, delta = "OK", 0.0
    else:
        status, delta = "MISMATCH", round(parsed - stated_r, 2)

    return {"label": label, "stated": stated_r, "parsed": parsed, "delta": delta, "status": status}


def check_contributions(results: list[dict]) -> pd.DataFrame:
    """
    Parse-completeness check: for each statement, verify that the sum of the
    parsed transaction rows equals the gross totals stated in the account
    summary — separately for employee (Pre-Tax/Roth/After-Tax) and employer
    (Company Match + Enhanced Contribution) money.

    Vesting is intentionally NOT applied here: there is no per-period "stated
    vested contribution" figure on the statement to validate against (the
    statement reports vested *balances*, not vested contributions).  Vesting is
    surfaced instead in the CONTRIBUTION TOTALS / by-date dump, where the
    per-source 'Vested Percent' from the statement is applied directly.
    """
    rows = []
    for r in results:
        summary = r["summary"]
        txns    = r["transactions"]
        txn_df  = pd.DataFrame(txns) if txns else pd.DataFrame(
            columns=["transaction_type", "source", "amount"])

        meta = {
            "file":         r["file"],
            "period_start": r["period_start"],
            "period_end":   r["period_end"],
        }

        # ── Employee contributions ───────────────────────────────────────────
        emp_stated = summary.get("your_contributions") or summary.get("employee_contributions")
        rows.append({**meta, **_check_one("Employee contributions",
                                          emp_stated, txn_df, _EMPLOYEE_SOURCES)})

        # ── Employer contributions (gross) ───────────────────────────────────
        co_total = summary.get("company_match")
        if co_total is not None:
            rows.append({**meta, **_check_one("Employer contributions",
                                              co_total, txn_df, _EMPLOYER_SOURCES)})

    return pd.DataFrame(rows)


def to_dataframes(results: list[dict]) -> dict[str, pd.DataFrame]:
    summaries, mktvals, txns = [], [], []
    for r in results:
        meta = {k: r[k] for k in ("file", "statement_type", "period_start", "period_end")}
        summaries.append({**meta, **r["summary"]})
        for row in r["market_value"]:
            mktvals.append({**meta, **row})
        for row in r["transactions"]:
            txns.append({**meta, **row})
    contributions_by_date = build_contributions_summary(results)
    return {
        "summary":               pd.DataFrame(summaries),
        "market_value":          pd.DataFrame(mktvals),
        "transactions":          pd.DataFrame(txns),
        "contributions_by_date": contributions_by_date,
        "contribution_totals":   build_contribution_totals(contributions_by_date),
        "contribution_check":    check_contributions(results),
    }


# ---------------------------------------------------------------------------
# Pretty stdout printer
# ---------------------------------------------------------------------------

def _fmt_dollars(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return "—"
    return f"${val:,.2f}"

def _fmt_pct(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return "—"
    return str(val)

def _section(title: str):
    width = 80
    print(f"\n{'─' * width}")
    print(f"  {title}")
    print(f"{'─' * width}")

def print_pretty(dfs: dict[str, pd.DataFrame]):
    pd.set_option("display.max_colwidth", 30)

    # ── Contribution check ────────────────────────────────────────────────────
    _section("CONTRIBUTION CHECK  (statement total vs. sum of parsed transactions)")
    chk = dfs["contribution_check"].copy()
    chk_rows = []
    for _, r in chk.iterrows():
        chk_rows.append({
            "File":    Path(r["file"]).stem,
            "Period":  f"{r['period_start']} – {r['period_end']}",
            "Check":   r["label"],
            "Stated":  _fmt_dollars(r.get("stated")),
            "Parsed":  _fmt_dollars(r.get("parsed")),
            "Delta":   ("—" if r.get("delta") is None
                        else ("—" if r["delta"] == 0.0
                              else _fmt_dollars(r["delta"]))),
            "Status":  r["status"],
        })
    print(pd.DataFrame(chk_rows).to_string(index=False))
    print("  (gross contributions — vesting is applied separately in CONTRIBUTION TOTALS)")
    mismatches = chk[chk["status"] == "MISMATCH"]
    if not mismatches.empty:
        print(f"\n  ⚠  {len(mismatches)} mismatch(es) detected — parsed transaction detail may be incomplete.")
    else:
        print("\n  All checks pass.")

    # ── Account Summary ──────────────────────────────────────────────────────
    _section("ACCOUNT SUMMARY")
    summary = dfs["summary"].copy()
    display_cols = [
        ("file",                    "File"),
        ("period_start",            "Start"),
        ("period_end",              "End"),
        ("beginning_balance",       "Beg. Balance"),
        ("ending_balance",          "End. Balance"),
        ("employee_contributions",  "Emp. Contrib"),
        ("your_contributions",      "Your Contrib"),
        ("company_match",           "Co. Match"),
        ("investment_gain_loss",    "Inv. G/L"),
        ("change_in_market_value",  "Mkt Chg"),
        ("personal_ror_this_period","RoR"),
    ]
    rows = []
    for _, r in summary.iterrows():
        row = {}
        for col, label in display_cols:
            val = r.get(col)
            if col in ("period_start", "period_end", "file", "personal_ror_this_period"):
                row[label] = "—" if (val is None or (isinstance(val, float) and pd.isna(val))) else str(val)
            else:
                row[label] = _fmt_dollars(val)
        rows.append(row)
    tbl = pd.DataFrame(rows)
    print(tbl.to_string(index=False))

    # ── Market Value ─────────────────────────────────────────────────────────
    _section("MARKET VALUE  (end of period)")
    mv = dfs["market_value"].copy()
    mv_rows = []
    for _, r in mv.iterrows():
        mv_rows.append({
            "File":       Path(r["file"]).stem,
            "Period End": r.get("period_end", "—"),
            "Fund":       r.get("investment", "—"),
            "Units (end)": f"{r['units_end']:,.3f}" if pd.notna(r.get("units_end")) else "—",
            "Price":      _fmt_dollars(r.get("price_end")),
            "Mkt Val (start)": _fmt_dollars(r.get("market_value_start")),
            "Mkt Val (end)":   _fmt_dollars(r.get("market_value_end")),
        })
    print(pd.DataFrame(mv_rows).to_string(index=False))

    # ── Contributions by period ───────────────────────────────────────────────
    _section("CONTRIBUTIONS BY PERIOD")
    contrib = dfs["contributions_by_date"].copy()
    if contrib.empty or contrib["total_amount"].isna().all():
        print("  No contribution data found.")
    else:
        # Roll up to period + type totals (gross and vested)
        grp = (
            contrib.dropna(subset=["total_amount"])
            .groupby(["file", "period_start", "period_end",
                      "beginning_balance", "ending_balance", "contribution_type"],
                     dropna=False)[["total_amount", "vested_amount"]]
            .sum()
            .reset_index()
        )
        period_rows = []
        for _, r in grp.iterrows():
            period_rows.append({
                "File":        Path(r["file"]).stem,
                "Period":      f"{r['period_start']} – {r['period_end']}",
                "Beg. Bal":    _fmt_dollars(r.get("beginning_balance")),
                "End. Bal":    _fmt_dollars(r.get("ending_balance")),
                "Type":        r.get("contribution_type") or "—",
                "Gross":       _fmt_dollars(r.get("total_amount")),
                "Vested":      _fmt_dollars(r.get("vested_amount")),
            })
        print(pd.DataFrame(period_rows).to_string(index=False))

    # ── Contributions by date (detail) ────────────────────────────────────────
    _section("CONTRIBUTIONS BY DATE  (detail — Vested = the amount to enter in your spreadsheet)")
    if contrib.empty or contrib["total_amount"].isna().all():
        print("  No contribution data found.")
    else:
        detail_rows = []
        for _, r in contrib.dropna(subset=["total_amount"]).iterrows():
            vp = r.get("vested_percent")
            detail_rows.append({
                "File":   Path(r["file"]).stem,
                "Date":   r.get("trade_date") or "—",
                "Type":   r.get("contribution_type") or "—",
                "Gross":  _fmt_dollars(r.get("total_amount")),
                "Vest%":  ("—" if vp is None or pd.isna(vp) else f"{vp:g}%"),
                "Vested": _fmt_dollars(r.get("vested_amount")),
            })
        print(pd.DataFrame(detail_rows).to_string(index=False))

    # ── Contribution totals (gross vs vested, with subtotals) ──────────────────
    _section("CONTRIBUTION TOTALS  (gross contributed vs. vested)")
    totals = dfs.get("contribution_totals")
    if totals is None or totals.empty:
        print("  No contribution data found.")
    else:
        out_rows = []
        g_emp_gross = g_emp_vest = g_er_gross = g_er_vest = 0.0
        for file, fgrp in totals.groupby("file", sort=True):
            stem = Path(file).stem
            for _, r in fgrp.sort_values(["kind", "source"]).iterrows():
                out_rows.append({
                    "File":   stem,
                    "Source": f"{r['source']}  ({r['kind']})",
                    "Gross":  _fmt_dollars(r["gross"]),
                    "Vest%":  ("—" if r["vested_percent"] is None or pd.isna(r["vested_percent"])
                               else f"{r['vested_percent']:g}%"),
                    "Vested": _fmt_dollars(r["vested"]),
                })
            emp = fgrp[fgrp["kind"] == "employee"]
            er  = fgrp[fgrp["kind"] == "employer"]
            eg, ev = emp["gross"].sum(), emp["vested"].sum()
            rg, rv = er["gross"].sum(),  er["vested"].sum()
            out_rows.append({"File": stem, "Source": "  └─ Employee total",
                             "Gross": _fmt_dollars(round(eg, 2)), "Vest%": "",
                             "Vested": _fmt_dollars(round(ev, 2))})
            out_rows.append({"File": stem, "Source": "  └─ Employer total",
                             "Gross": _fmt_dollars(round(rg, 2)), "Vest%": "",
                             "Vested": _fmt_dollars(round(rv, 2))})
            g_emp_gross += eg; g_emp_vest += ev; g_er_gross += rg; g_er_vest += rv
        print(pd.DataFrame(out_rows).to_string(index=False))
        print(f"\n  GRAND TOTAL  Employee:  gross {_fmt_dollars(round(g_emp_gross,2))}"
              f"   vested {_fmt_dollars(round(g_emp_vest,2))}")
        print(f"  GRAND TOTAL  Employer:  gross {_fmt_dollars(round(g_er_gross,2))}"
              f"   vested {_fmt_dollars(round(g_er_vest,2))}"
              f"   (forfeited {_fmt_dollars(round(g_er_gross - g_er_vest,2))})")

    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(pdf_paths: list[str], output_dir: str | None, write_csv: bool, pretty: bool):
    results = []
    for p in pdf_paths:
        try:
            results.append(parse_pdf(p))
        except Exception as exc:
            print(f"  ERROR {p}: {exc}")

    if not results:
        print("No results.")
        return

    dfs = to_dataframes(results)

    if write_csv:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        print()
        for name, df in dfs.items():
            if df.empty:
                print(f"  [skip] {name} — no data")
                continue
            csv_path = out / f"401k_{name}.csv"
            df.to_csv(csv_path, index=False)
            print(f"  Wrote {len(df):>4} rows → {csv_path}")
        for r in results:
            stem = Path(r["file"]).stem
            ocr_path = out / f"{stem}_ocr.txt"
            with open(ocr_path, "w") as f:
                for i, page in enumerate(r["_raw_pages"], 1):
                    f.write(f"\n{'='*60}\nPAGE {i}\n{'='*60}\n{page}")
            print(f"  Raw OCR → {ocr_path}")

    if pretty:
        print_pretty(dfs)

    print("Done.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Parse Fidelity 401(k) PDF statements (NTESS/Sandia and L3Harris formats).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 scripts/parse-fidelity-pdf.py Sandia_2016.pdf --stdout\n"
            "  python3 scripts/parse-fidelity-pdf.py *.pdf --csv\n"
            "  python3 scripts/parse-fidelity-pdf.py *.pdf --csv --stdout\n"
            "  python3 scripts/parse-fidelity-pdf.py *.pdf --csv -o ~/Documents/output\n"
            "  python3 scripts/parse-fidelity-pdf.py          # defaults to --csv in the PDF's folder"
        ),
    )
    parser.add_argument(
        "pdfs",
        nargs="*",
        metavar="FILE.pdf",
        help="One or more PDF statement files. Defaults to all PDFs in the script's folder.",
    )
    parser.add_argument(
        "--csv",
        action="store_true",
        help="Write parsed data to CSV files (and raw OCR .txt files).",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print a formatted summary to the terminal.",
    )
    parser.add_argument(
        "-o", "--output",
        metavar="DIR",
        default=None,
        help="Directory for CSV output (default: same folder as first PDF). Only used with --csv.",
    )

    args = parser.parse_args()

    if args.pdfs:
        paths = args.pdfs
    else:
        script_dir = Path(__file__).parent
        paths = sorted(glob.glob(str(script_dir / "*.pdf")))

    if not paths:
        parser.error("No PDF files found. Pass at least one file or place PDFs alongside this script.")

    # Default to CSV if neither flag given (backward compatible)
    write_csv = args.csv or (not args.csv and not args.stdout)
    pretty    = args.stdout

    output_dir = args.output if args.output else str(Path(paths[0]).parent)

    print(f"Parsing {len(paths)} PDF(s)...")
    main(paths, output_dir=output_dir, write_csv=write_csv, pretty=pretty)
