"""Builds site/index.html from site/src/index.html.

Social icon paths come from Simple Icons (CC0, https://simpleicons.org).
Run:  python3 site/build.py
"""
from pathlib import Path

ROOT = Path(__file__).parent
ICONS = {
    "Telegram": ("https://t.me/verification_project", ROOT / "src/icons/telegram.svg"),
    "ВКонтакте": ("https://vk.ru/verification.project", ROOT / "src/icons/vk.svg"),
    "Instagram": ("https://instagram.com/verification.official", ROOT / "src/icons/instagram.svg"),
    "YouTube": ("https://youtube.com/@verification_sound", ROOT / "src/icons/youtube.svg"),
    "Слушать альбом": ("https://band.link/ejuVc", ROOT / "src/icons/listen.svg"),
}


def social() -> str:
    out = []
    for label, (href, svg) in ICONS.items():
        body = svg.read_text(encoding="utf-8").strip()
        body = body.replace("<svg ", '<svg aria-hidden="true" focusable="false" ', 1)
        out.append(f'<a href="{href}" target="_blank" rel="noopener" aria-label="{label}">{body}</a>')
    return "".join(out)


def main() -> None:
    src = (ROOT / "src/index.html").read_text(encoding="utf-8")
    html = src.replace("{{SOCIAL}}", social())
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print("wrote", ROOT / "index.html")


if __name__ == "__main__":
    main()
