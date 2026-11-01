from datetime import datetime, timedelta
import calendar
from typing import Optional

def parse_date(date_str: str) -> Optional[datetime]:
    formats = ["%Y-%m-%d", "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%d/%m/%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None

def compute_late_fee(days_late: int, per_day: float) -> float:
    return float(days_late * per_day)

def add_days(date_str: str, n: int) -> str:
    dt = parse_date(date_str)
    if not dt:
        return date_str
    res = dt + timedelta(days=n)
    return res.strftime("%Y-%m-%d")

def subtract_days(date_str: str, n: int) -> str:
    dt = parse_date(date_str)
    if not dt:
        return date_str
    res = dt - timedelta(days=n)
    return res.strftime("%Y-%m-%d")

def add_months(date_str: str, n: int) -> str:
    dt = parse_date(date_str)
    if not dt:
        return date_str
    
    month = dt.month - 1 + n
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    res = datetime(year, month, day)
    return res.strftime("%Y-%m-%d")

def penalty(months: int, rent: float) -> float:
    return float(months * rent)
