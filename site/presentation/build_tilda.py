"""Builds presentation/tilda/presentation-tilda.html: the press page as one T123 block.
Images come from this repo via jsDelivr, pinned to a commit.  Run: python3 site/presentation/build_tilda.py <sha>"""
import re, sys
from pathlib import Path
ROOT = Path(__file__).parent
SHA = sys.argv[1]
GH = f"https://cdn.jsdelivr.net/gh/evsapelov-eng/2@{SHA}/site/presentation/assets/"
html = (ROOT / "src/presentation.html").read_text(encoding="utf-8")
a = html.index("<!--ARTIFACT-START-->") + len("<!--ARTIFACT-START-->"); b = html.index("<!--ARTIFACT-END-->")
s = html[a:b].replace("</head>\n<body>\n", "")
s = re.sub(r"<title>.*?</title>\n", "", s); s = re.sub(r"<meta [^>]*>\n", "", s)
s = s.replace("body { margin: 0; background: #000; }", "body, .t-body, #allrecords { margin: 0; background: #000 !important; }")
s = s.replace('src="assets/', 'src="' + GH)
assert "assets/" not in s.replace(GH, "")
out = ROOT / "tilda" / "presentation-tilda.html"; out.parent.mkdir(exist_ok=True)
out.write_text("<!-- VERIFICATION, презентация: вставьте весь этот код в блок T123 «HTML-код» на отдельной странице -->\n" + s.strip() + "\n", encoding="utf-8")
print("wrote", out, len(out.read_text(encoding="utf-8")), "chars")
