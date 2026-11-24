"""Inline-клавиатуры. callback_data — не длиннее 64 байт.

Схема callback_data:
  m                 главное меню
  in:<f>:<p>        входящие, фильтр f (a/o/s/d/k), страница p
  r:<id>:<act>[:<f>:<p>]  действие с рекомендацией (alt/snz/ans/skp/reo); f и p — если нажато во входящих
  st:<period>       аналитика (t/7/30/all)
  ar:<p>            архив, страница p
  ap:<id>:<p>       пост из архива
  id:<s>:<i>        идеи со статусом s (n/w/u/r), позиция i
  ix:<id>:<s>:<from>:<i>  смена статуса идеи
  se / se:<key>     настройки
  pz                приостановить / возобновить уведомления
"""

from __future__ import annotations


def btn(text: str, data: str) -> dict:
    assert len(data.encode()) <= 64, data
    return {"text": text, "callback_data": data}


def url_btn(text: str, url: str) -> dict:
    return {"text": text, "url": url}


def markup(rows: list[list[dict]]) -> dict:
    return {"inline_keyboard": [row for row in rows if row]}


def recommendation_keyboard(rec_id: int, link: str, status: str, origin: str = "") -> dict:
    suffix = f":{origin}" if origin else ""
    rows = [[url_btn("Открыть комментарий", link)]]
    if status in ("pending", "notified", "snoozed"):
        rows.append([btn("Другой вариант ответа", f"r:{rec_id}:alt{suffix}")])
        rows.append(
            [
                btn("Напомнить позже", f"r:{rec_id}:snz{suffix}"),
                btn("Уже ответил", f"r:{rec_id}:ans{suffix}"),
            ]
        )
        rows.append([btn("Пропустить", f"r:{rec_id}:skp{suffix}")])
    else:
        rows.append([btn("Вернуть во входящие", f"r:{rec_id}:reo{suffix}")])
    return markup(rows)


def back_to_menu() -> list[dict]:
    return [btn("Меню", "m")]


def pager(prefix: str, page: int, total_pages: int) -> list[dict]:
    if total_pages <= 1:
        return []
    row = []
    if page > 0:
        row.append(btn("‹", f"{prefix}:{page - 1}"))
    row.append(btn(f"{page + 1} / {total_pages}", f"{prefix}:{page}"))
    if page < total_pages - 1:
        row.append(btn("›", f"{prefix}:{page + 1}"))
    return row
