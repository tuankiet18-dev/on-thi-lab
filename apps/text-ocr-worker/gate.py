"""Decide whether a question image can safely become text.

Two independent readers (Tesseract and PaddleOCR) each return one string per located text block. A question is
approved only when both agree on every field and nothing suggests content that OCR cannot represent. Anything
doubtful is `needs_review`, which keeps the original image on screen.
"""
import re
import unicodedata

with open("/usr/share/dict/american-english", encoding="utf-8") as _words:
    _WORDS = {w.strip().lower() for w in _words if w.strip()}
# Technical vocabulary that general dictionaries lack; extend when a real question is wrongly kept as an image.
_WORDS |= {
    "api", "ui", "ux", "url", "http", "https", "html", "css", "sql", "java", "javascript", "json", "xml", "ip",
    "ipv4", "ipv6", "mac", "dhcp", "dns", "tcp", "udp", "osi", "mvvm", "mvc", "tempdata", "grpc", "react",
    "android", "unity", "wifi", "online", "email", "login", "backend", "frontend", "ai", "cpu", "gpu", "ram",
    "rom", "usb", "lan", "wan", "vpn", "ssh", "tftp", "arp",
}

# Screen chrome that surrounds the question in exam screenshots.
_NOISE = re.compile(
    r"^(\(?\s*choose\s+(one|\d+|all|any)\s+answers?\s*\)?|multiple\s+choice|question\s*:?\s*\d+|answer|back\s*next|"
    r"back|next|exit|q:\s*\d+|.*fuoverflow.*)$",
    re.I,
)
_LABEL = re.compile(r"^[|\[\]\s]*\(?\s*([A-F])\s*[.)_,:]\s*", re.I)
# Readers sometimes prepend a stray word before the label or glue it to the text ("A.Product").
_LOOSE_LABEL = re.compile(r"^(?:\S+\s+){0,2}?[|\[\]\s]*\(?\s*([A-F])\s*[.)_,:]?\s*(?=\S)")
# Capital I and lowercase l look identical in this font: "AI" vs "Al", "UI" vs "Ul", "FileInputStream".
_IL_AMBIGUOUS = re.compile(r"[A-Z]l(?![a-z])|[A-Z]l[A-Z]|(?<![A-Za-z])l[A-Z]|[a-z]I(?![a-z])|[a-z]I[A-Z]")
_CODE_LIKE = re.compile(r"[=_{}<>;\\\[\]^~|]|\w\(\)")
_LETTER_AMBIGUOUS = re.compile(r"[a-z]I|Il|lI|[a-zA-Z]1|1[a-zA-Z]|ln|0[a-z]|[a-z]0")


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").replace("…", "...")
    return re.sub(r"\s+", " ", text).strip()


def _core(token: str) -> str:
    return re.sub(r"^[\W_]+|[\W_]+$", "", token)


def _fix_spacing_and_case(text: str) -> str:
    """Generic OCR repairs: '2bytes' -> '2 bytes' and a stray capital I inside a short lowercase word ('In' -> 'in')."""
    out: list[str] = []
    for token in text.split(" "):
        glued = re.fullmatch(r"(\d+)([A-Za-z]{3,})", token)
        if glued and glued.group(2).lower() in _WORDS:
            out.append(f"{glued.group(1)} {glued.group(2)}")
            continue
        core = _core(token)
        previous = out[-1] if out else None
        starts_sentence = previous is None or re.search(r"[.?!:;]$", previous)
        if core[:1] == "I" and 2 <= len(core) <= 3 and core.lower() in _WORDS and not starts_sentence and core[1:].islower():
            token = token.replace(core, core.lower(), 1)
        out.append(token)
    return " ".join(out)


def unknown_tokens(text: str) -> list[str]:
    """Word tokens that are not dictionary words, acronyms, numbers or identifiers."""
    unknown = []
    for token in text.split():
        core = _core(token)
        if not core or re.search(r"\d", core) or "_" in core or "@" in core:
            continue
        if core.isupper() and len(core) <= 8 or re.search(r"[a-z][A-Z]", core):
            continue
        if core.lower() in _WORDS:
            continue
        parts = [p for p in re.split(r"[-/'’.]", core.lower()) if p]
        if len(parts) > 1 and all(p in _WORDS or p.isdigit() for p in parts):
            continue
        unknown.append(core)
    return unknown


def _is_english(text: str) -> bool:
    return all(c.isascii() or not c.isalpha() for c in text)


def parse_spans(tess_blocks: list[str]):
    """Indices of the blocks forming the stem and each option, from Tesseract's reading. None if A, B, ... is missing."""
    keep = [i for i, t in enumerate(tess_blocks) if not _NOISE.match(_norm(t))]
    starts: list[int] = []
    expected = "A"
    for pos, i in enumerate(keep):
        m = _LABEL.match(_norm(tess_blocks[i]))
        if m and m.group(1).upper() == expected:
            starts.append(pos)
            expected = chr(ord(expected) + 1)
    if len(starts) < 2:
        return None
    ends = starts[1:] + [len(keep)]
    return keep[: starts[0]], [keep[s:e] for s, e in zip(starts, ends)]


def _fields(blocks: list[str], spans, strip_loosely: bool) -> list[str]:
    stem_idx, option_idx = spans

    def join(indices, label=False):
        parts = [_norm(blocks[i]) for i in indices]
        if label and parts:
            pattern = _LOOSE_LABEL if strip_loosely else _LABEL
            m = pattern.match(parts[0])
            parts[0] = parts[0][m.end():].strip() if m else parts[0]
        return _fix_spacing_and_case(_norm(" ".join(parts)))

    return [join(stem_idx)] + [join(ix, True) for ix in option_idx]


def _result(status, flags, fields=None):
    approved = status == "approved"
    return {
        "status": status,
        "textContent": fields[0] if fields else "",
        "options": fields[1:] if fields else [],
        "flagReasons": flags,
        # Not a probability: 1 means both readers produced identical text for every field.
        "confidence": 1.0 if approved else 0.0,
    }


def decide(readings: dict[str, list[str]], extra_ink: int, has_blank: bool) -> dict:
    """`readings`: {"tess": [...], "paddle": [...]}, one string per located block (same blocks for both)."""
    tess, paddle = readings["tess"], readings["paddle"]
    spans = parse_spans(tess)
    if spans is None or len(paddle) != len(tess):
        return _result("needs_review", ["no_structure"])
    a = _fields(tess, spans, strip_loosely=False)
    b = _fields(paddle, spans, strip_loosely=True)
    flags: list[str] = []
    if a != b:
        flags.append("field_disagreement")
    if any(not f for f in a):
        flags.append("empty_field")
    if extra_ink > 150:
        flags.append("extra_content")
    if has_blank:
        flags.append("blank_in_text")
    if not all(_is_english(f) for f in a):
        flags.append("non_english")
    elif any(_CODE_LIKE.search(f) for f in a):
        flags.append("code_like")
    if any(_IL_AMBIGUOUS.search(_core(t)) or (re.search(r"[a-z][A-Z]", _core(t)) and re.search(r"[lI]", _core(t)))
           for f in a for t in f.split()):
        flags.append("ambiguous_il")
    # A short lowercase word ending a sentence or abbreviation ("inc.", "ltd.") may really start with a capital I.
    if any(re.fullmatch(r"[il][a-z]{1,3}\.", _core(t) + ("." if t.endswith(".") else "")) for f in a for t in f.split()):
        flags.append("ambiguous_il")
    if any(t[:1] in "iIlL" or _LETTER_AMBIGUOUS.search(t) for f in a for t in unknown_tokens(f)):
        flags.append("unconfirmed_word")
    return _result("needs_review" if flags else "approved", flags, a)
