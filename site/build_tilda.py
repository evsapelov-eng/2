"""Builds tilda/verification-tilda.html: the site as one block for Tilda's T123 "HTML code" block.

Media come from Tilda's own CDN (already uploaded for the old site); the three images made for this
site come from this public repo via jsDelivr, pinned to a commit so they never change under the page.
Run after build.py:  python3 site/build_tilda.py <commit-sha>
"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).parent
SHA = sys.argv[1]
GH = f"https://cdn.jsdelivr.net/gh/evsapelov-eng/2@{SHA}/site/assets/"
TILDA = {
    "assets/hero.mp4": "https://static.tildacdn.com/vide6234-6136-4862-a431-643461393531/25235806489180.mp4",
    "assets/album.jpg": "https://static.tildacdn.com/tild3664-3834-4236-b333-323933393335/noroot.png",
    "assets/manager.jpg": "https://static.tildacdn.com/tild6330-6135-4631-b264-633237333865/15203e87-5c51-411c-a.jpg",
}
PHOTOS = [
    "tild3037-3663-4364-a134-656461633638/71f0a3d2-25c1-4409-9.jpg", "tild3462-3836-4734-b435-356335393330/6ad40d8e-1a0f-4556-b.jpg",
    "tild6366-3565-4530-b737-376533303632/150b0ca8-0974-4feb-8.jpg", "tild3535-3334-4335-b739-623736666234/337785e8-fe11-4489-a.jpg",
    "tild6361-3061-4237-a462-343735623134/a5395259-27ab-44a1-b.jpg", "tild6164-6262-4637-b864-343734346436/d8b752d6-cdc9-4bfe-b.jpg",
    "tild3637-3435-4664-b931-343566356232/f8c75026-1e34-4d31-a.jpg", "tild3631-6335-4336-a436-643938646137/c356eb61-733f-49cf-a.jpg",
    "tild3862-6236-4164-b338-343666306232/76722e2c-bb9d-44ab-9.jpg", "tild6430-6233-4366-a638-373361396130/a65398cc-3445-4222-8.jpg",
    "tild6430-3064-4132-a238-393063353839/d9ae9161-174e-47cf-9.jpg", "tild3139-3036-4765-b135-306539316137/f4d67967-76c3-4805-9.jpg",
    "tild3063-3035-4632-a137-346438323665/5a1dfd25-985a-436b-9.jpg", "tild3466-3662-4562-a265-306538613066/38a9b959-1f92-41c0-9.jpg",
    "tild3539-3761-4662-a230-643965303932/51ddaea4-e2c3-430a-a.jpg", "tild3136-3561-4239-a366-663830343263/65bb0c3e-3dd3-498a-8.jpg",
]


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    a = html.index("<!--ARTIFACT-START-->") + len("<!--ARTIFACT-START-->")
    b = html.index("<!--ARTIFACT-END-->")
    s = html[a:b].replace("</head>\n<body>\n", "")
    # Tilda sets title, description and og tags in its own page settings
    s = re.sub(r"<title>.*?</title>\n", "", s)
    s = re.sub(r"<meta [^>]*>\n", "", s)
    for k, v in TILDA.items():
        s = s.replace(k, v)
    for name in ("bg-dark.jpg", "bg-dark-tall.jpg", "home-photo.jpg"):
        s = s.replace("assets/" + name, GH + name)
    urls = ",".join('"https://static.tildacdn.com/' + p + '"' for p in PHOTOS)
    s = s.replace("  var PHOTOS = 16;", "  var PHOTOS = 16;\n  var PHOTO_URLS = [" + urls + "];", 1)
    s = s.replace("""src="assets/media/' + n + '-thumb.jpg\"""", """src="' + PHOTO_URLS[i - 1] + '\"""")
    s = s.replace('var src = "assets/media/" + n + ".jpg"', "var src = PHOTO_URLS[cur - 1]")
    left = re.findall(r"(?<!site/)assets/[\w./-]+", s)
    assert not left, left
    out = ROOT / "tilda" / "verification-tilda.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text("<!-- VERIFICATION: вставьте весь этот код в блок T123 «HTML-код» -->\n" + s.strip() + "\n", encoding="utf-8")
    print("wrote", out, len(out.read_text(encoding="utf-8")), "chars")


if __name__ == "__main__":
    main()
