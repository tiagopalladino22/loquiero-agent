import json, re, sys
from rapidocr_onnxruntime import RapidOCR

path = sys.argv[1]
expected_amount = float(sys.argv[2]) if len(sys.argv) > 2 else None
expected_date = sys.argv[3] if len(sys.argv) > 3 else None  # YYYY-MM-DD
expected_recipients = [s.strip().lower() for s in (sys.argv[4] if len(sys.argv) > 4 else '').split('|') if s.strip()]

ocr = RapidOCR()
res, _ = ocr(path)
lines = [str(item[1]).strip() for item in (res or []) if str(item[1]).strip()]
text = "\n".join(lines)
compact = re.sub(r"\s+", "", text).lower()

def parse_amount(s):
    # Prefer Argentine amount with thousands dot + decimal comma.
    matches = re.findall(r"\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+[\.,]\d{2}\b", s)
    vals = []
    for m in matches:
        v = m.replace('.', '').replace(',', '.')
        try: vals.append((m, float(v)))
        except: pass
    return vals[-1] if vals else (None, None)

amount_raw, amount = parse_amount(text)
status_ok = bool(re.search(r"COMPLETAD[AO]|APROBAD[AO]|EXITOS[AO]", text, re.I))
# Date: supports "19 de agosto de 2026".
months = {'enero':'01','febrero':'02','marzo':'03','abril':'04','mayo':'05','junio':'06','julio':'07','agosto':'08','septiembre':'09','setiembre':'09','octubre':'10','noviembre':'11','diciembre':'12'}
date_iso = None
m = re.search(r"(\d{1,2})\s*de\s*([a-záéíóúñ]+)\s*de\s*(\d{4})", text, re.I)
if m:
    day = int(m.group(1)); mon = months.get(m.group(2).lower())
    if mon: date_iso = f"{m.group(3)}-{mon}-{day:02d}"
else:
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b", text)
    if m:
        y = m.group(3); y = '20'+y if len(y)==2 else y
        date_iso = f"{y}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"

recipient_ok = any(r.replace(' ', '') in compact for r in expected_recipients)
amount_ok = expected_amount is None or (amount is not None and abs(amount - expected_amount) < 0.01)
date_ok = expected_date is None or date_iso == expected_date
approved = bool(amount_ok and recipient_ok and date_ok and status_ok)
print(json.dumps({
    'ok': True,
    'text': text,
    'amount_raw': amount_raw,
    'amount': amount,
    'date': date_iso,
    'status_ok': status_ok,
    'recipient_ok': recipient_ok,
    'amount_ok': amount_ok,
    'date_ok': date_ok,
    'approved': approved,
}, ensure_ascii=False))
