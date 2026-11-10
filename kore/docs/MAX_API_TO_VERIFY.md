# API Max, написанные по памяти — проверить на Mac

docs.cycling74.com недоступен из среды разработки. Всё из `noiz/docs/MAX_API_TO_VERIFY.md` (#1–#17: transport, svf~, pipe, poly~/steal, thispoly~, pattr Blob, Global/Task, jsui mgraphics, live.path/observer, expr) действует и здесь. Новое в KØRE:

| # | Что | Предположение | Как проверить |
|---|---|---|---|
| K1 | `dbtoa~` | сигнал дБ → амплитуда | PUNCH звучит и затухает |
| K2 | `cycle~` правый вход | float задаёт фазу 0..1 (сброс) | удары одинаковы по атаке |
| K3 | `tapin~ 1200` → `tapout~ 47 83` | 2 выхода-тапа; обратная связь через tapin~/tapout~ разрешена | RUMBLE даёт хвост, не разгоняется |
| K4 | `peakamp~ 33` | выдаёт пик каждые 33 мс | индикаторы OUT/KICK двигаются |
| K5 | `pcontrol` → `[p KORE_EDITOR]` | `open`/`close` открывает/закрывает окно сабпатча | OPEN EDITOR / CLOSE |
| K6 | Окно сабпатча из работающего устройства | открывается заблокированным, в presentation, без тулбара | клики по редактору работают, а не выделяют объекты |
| K7 | `jsui` `jsarguments` | `jsarguments[1]` = "compact" / "editor" | в устройстве полоса, в окне — редактор |
| K8 | `[f 0.6]` + `loadbang` в абстракции `kore_rumble` | срабатывают при загрузке | RUMBLE не молчит до первого шага |
| K9 | `expr max(a\,b)` / `min(...)` | функции expr | sweep и feedback считаются |
