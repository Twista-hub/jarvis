"""Plain text from tender documents: PDF (pdftotext), DOCX, XLSX. ZIPs are skipped (same files)."""
import re
import subprocess
import zipfile
from pathlib import Path

# Long legal boilerplate that rarely matters for a first assessment.
SKIP = re.compile(r"tarifvertrag|verpflichtungserkl|sanktion|datenschutz|kennzettel", re.I)


def text_of(path: Path) -> str:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            return subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, timeout=120).stdout
        if suffix == ".docx":
            xml = zipfile.ZipFile(path).read("word/document.xml").decode(errors="replace")
            return re.sub(r"<[^>]+>", " ", xml.replace("</w:p>", "\n"))
        if suffix == ".xlsx":
            z = zipfile.ZipFile(path)
            if "xl/sharedStrings.xml" not in z.namelist():
                return ""
            ss = z.read("xl/sharedStrings.xml").decode(errors="replace")
            return "\n".join(re.sub(r"<[^>]+>", "", s) for s in re.findall(r"<si>(.*?)</si>", ss, re.S))
    except Exception:  # noqa: BLE001
        return ""
    return ""


def bundle(files: list[Path], max_chars: int = 350_000) -> tuple[str, list[str]]:
    """All documents as one text, most important first; skipped names are returned."""
    order = lambda p: (0 if re.search(r"leistungsbeschreibung|aufforderung|^b0|^a0", p.name, re.I) else 1, p.name)
    parts, skipped, total = [], [], 0
    for f in sorted(files, key=order):
        if f.suffix.lower() == ".zip":
            continue
        if SKIP.search(f.name):
            skipped.append(f.name)
            continue
        t = re.sub(r"[ \t]{2,}", " ", text_of(f))
        t = re.sub(r"\n\s*\n+", "\n", t).strip()
        if not t:
            continue
        if total + len(t) > max_chars:
            skipped.append(f.name + " (zu lang)")
            continue
        parts.append(f"===== DATEI: {f.name}\n{t}")
        total += len(t)
    return "\n\n".join(parts), skipped
