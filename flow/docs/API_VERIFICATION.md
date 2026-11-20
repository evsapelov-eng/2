# Live API — что подтверждено и чем

Легенда:
- **DOC** — прочитано на официальной странице Cycling '74 (дата проверки 2026-11-20; на страницах указано «Copyright © 2024 Cycling '74», версия Live на них не названа).
- **LIVE** — подтверждено запуском в Live (пока таких пунктов нет).
- **OPEN** — неизвестно, измеряется экспериментом M0 (E-номер из `M0_SPIKE_PROTOCOL.md`).

## Song (`live_set`) — https://docs.cycling74.com/apiref/lom/song/

| Элемент | Тип / доступ | Источник | Цитата / примечание |
|---|---|---|---|
| `current_song_time` | float, get/set/observe | DOC | «The playing position in the Live Set, in beats.» Квантуется ли set при воспроизведении — **OPEN (E7)** |
| `is_playing` | bool, get/set/observe | DOC | «Get/set if Live's transport is running.» |
| `loop` | bool, get/set/observe | DOC | «Get/set the enabled state of the Arrangement loop.» |
| `loop_start` | float, get/set/observe | DOC | «Arrangement loop start in beats.» |
| `loop_length` | float, get/set/observe | DOC | «Arrangement loop length in beats.» |
| `tempo` | float, get/set/observe | DOC | 20…999 BPM; «may be automated» → FLOW обязан наблюдать, а не кэшировать |
| `signature_numerator` / `_denominator` | int, get/set/observe | DOC | Единица «beat» = четверть? — **OPEN (E2)** |
| `cue_points` | list of CuePoint, get/observe | DOC | «markers in the Arrangement to which you can jump» |
| `back_to_arranger` | bool, get/set/observe | DOC | «indicate that the current state of the playback differs from what is stored in the Arrangement. Setting this property to 0 will make Live go back to playing the content of the arrangement.» → детектор `BACK TO ARRANGEMENT` (§8 ТЗ) |
| `clip_trigger_quantization` | int, get/set/observe | DOC | 0=None, 4=1 Bar … — нужно, чтобы понимать квантованные прыжки |
| `start_time` | float, get/set/observe | DOC | «where playing will start» |
| `song_length`, `last_event_time` | float, get(/observe) | DOC | Граница последней секции при импорте локаторов (кандидат, а не истина) |
| `start_playing` / `stop_playing` / `continue_playing` | function | DOC | «Start playback from the insert marker» / «Stop the playback» / «From the current playback position» |
| `jump_by`, `scrub_by` | function(beats) | DOC | Относительный прыжок; квантование не описано |
| `jump_to_next_cue` / `jump_to_prev_cue` | function | DOC | FLOW **не** использует для setlist (§8 ТЗ) |
| `set_or_delete_cue` | function | DOC | **Не используется**: FLOW не создаёт локаторы без разрешения |
| `get_current_beats_song_time` | function → `bars.beats.sixteenths.ticks` | DOC | Используется в E2 для проверки собственного перевода в такты |

## CuePoint (`live_set cue_points N`) — https://docs.cycling74.com/apiref/lom/cuepoint/

| Элемент | Тип / доступ | Источник | Цитата |
|---|---|---|---|
| `name` | symbol, get/set/observe | DOC | — (FLOW только читает) |
| `time` | float, get/observe | DOC | «Arrangement position of the marker in beats.» |
| `jump` | function | DOC | «Set current Arrangement playback position to marker, **quantized if song is playing**.» Фактическая квантизация — **OPEN (E8)** |

## JS LiveAPI / Task — https://docs.cycling74.com/apiref/js/liveapi/ , …/js/task/

| Утверждение | Источник | Следствие для FLOW |
|---|---|---|
| «you cannot use the LiveAPI object in JavaScript global code. Use the live.thisdevice object…» | DOC | Инициализация только по `live.thisdevice → deferlow → init` |
| «The LiveAPI object cannot be created or used in the high-priority thread… use the defer or deferlow objects» | DOC | Никаких LiveAPI-вызовов из `timepoint`/`metro` high-priority без `deferlow` |
| Task: «the latency between the scheduled time and the actual execution time … is variable because the function runs in a low-priority thread… avoid using a Task function in a time-critical operation» | DOC | Никакой «sample-accurate» логики на JS-таймерах. Точные границы — только нативными механизмами Live (wrap петли, квантованный `CuePoint.jump`); JS лишь заранее «взводит» их с запасом (E5/E6) |
| Изменение Live из колбэка observer'а запрещено | OPEN (E10) | Широко известное ограничение; spike всё равно никогда так не делает |
| `live.observer`/LiveAPI-уведомления `current_song_time` — частота | OPEN (E1) | Определяет точность оценки позиции и минимальный запас |

## Ключевые гипотезы, которые проверяет M0

1. **H-RELEASE**: выключить `loop` в любой момент *до* точки wrap — значит, Live сам линейно пройдёт конец петли (без JS-тайминга на границе). Риск только в последних N мс → E4/E5 дают N.
2. **H-HOLD**: брейс (`loop_start/length`) можно выставить заранее при `loop=0`, а `loop=1` — с запасом ≥ N мс. Что будет при опоздании — E6.
3. **H-WRAPJUMP**: прыжок назад на границе такта можно сделать нативно — петлёй `[target, boundary)` с последующим `loop=0` (E9).
4. **H-CUEJUMP**: прыжок вперёд на границе такта нативно делает `CuePoint.jump`, если на цели стоит локатор (E8).
5. **H-SEEK**: `current_song_time` при игре — мгновенный (тогда прыжок по JS-таймеру = джиттер, режим EXPERIMENTAL) или квантованный (E7).

## Сверка формата `.amxd` с эталонами Ableton (2026-11-20)

Источник: официальный репозиторий Ableton [`Ableton/maxdevtools`](https://github.com/Ableton/maxdevtools) (`maxdiff/amxd_textconv.py` и `.amxd`, сохранённые самим Max: `maxdiff/tests/test_files/Test.amxd`, `cpu-reporter/CPU Reporter.amxd`, `load-time-tester/DoneLoading.amxd`).

- Контейнер: последовательность чанков `[4 байта ASCII id][uint32 little-endian длина][данные]`: `ampf` (4 байта, тип: `mmmm` = MIDI Effect), `meta` (4 байта), `ptch` (JSON патча, оканчивается `\n` + NUL). **Наш файл совпадает по структуре** (проверено побайтово по заголовкам и окончанию).
- Поля верхнего уровня патча (`openrect`, `project.amxdtype` = 1835887981 для MIDI Effect, `latency`, `is_mpe` и др.) приведены к виду файлов, сохранённых Max 8.6/9.1.
- Открытие в Live по-прежнему **не проверено** (нужен запуск), но риск R1 существенно снижен.

## Опыт сообщества (форумы Cycling '74) — не официальная документация

| Тема | Что сообщают | Как учтено |
|---|---|---|
| [Установка `current_song_time` во время игры](https://cycling74.com/forums/setting-cursorplaying-position-with-current_song_time-or-jump_by) | Прыжок происходит, но момент «непредсказуем»; иногда Live прыгает в последнюю точку клика мышью | Подтверждает решение: произвольный seek — EXPERIMENTAL; предпочтение нативным механизмам (wrap петли, `CuePoint.jump`). E7 всё равно нужен |
| [Тот же вопрос, остановленный транспорт](https://cycling74.com/forums/how-to-set-the-live-arrangement-position-via-m4l) | При остановке задаётся точка старта; обходной путь — сначала play, потом прыжок | Учесть в M1 для NEXT при остановленном транспорте |
| [«Changes cannot be triggered by notifications»](https://cycling74.com/forums/live-object-changes-cannot-be-triggered-by-notifications-2) | Изменения Live из уведомлений запрещены; помогает `deferlow` или JS `Task` | Совпадает с архитектурой spike (все команды из Task-тика) |
| [Loop start/end через API](https://docs.cycling74.com/max7/vignettes/live_object_model) (пересказ форумной темы в поиске) | Значения брейса «ведут себя ожидаемо» только при включённом loop | Риск для гипотезы H-HOLD (брейс заранее при `loop=0`) — проверяется в E6; spike читает значения обратно после set |

## Опыт открытых проектов на GitHub (2026-11-20)

Найдено поиском кода GitHub по `current_song_time`, `loop_start`, `cue_points`, `back_to_arranger`. Это наблюдения других разработчиков, а не документация; их код в FLOW **не копируется**, используются только факты о поведении Live.

| Факт | Источник | Что изменено во FLOW |
|---|---|---|
| `loop_start`, `loop_length`, `start_time` читаются обратно сразу после записи; **`loop` — ещё ~25 мс старое значение** | [adamjmurray/producer-pal](https://github.com/adamjmurray/producer-pal) `src/tools/session/helpers/playback/arrangement-playback.ts` | Spike: границы проверяются сразу, `loop` подтверждается уведомлением observer'а (раньше был бы ложный MISMATCH). Симулятор приведён к этому поведению |
| `is_playing` и `current_song_time` обновляются асинхронно после команд | producer-pal `dev/specs/.../playback-and-sends.md`, `locator-updates.ts` | Подтверждает правило: состояние FLOW меняется только после подтверждения от observer'а |
| Live хранит 32-битные float (0.123456789 → 0.12345699965953827) | producer-pal `mock-registry-helpers.ts`, `read-back-comparison.ts` | Допуск сравнения долей 1e-4 (`sameBeat`) |
| `stop` при **уже остановленном** транспорте отправляет playhead и start marker в начало | producer-pal `playback-and-sends.md` | STOP во FLOW: сначала проверять `is_playing`, иначе ничего не делать |
| Запись `start_time` во время игры не двигает playhead; `start_playing` всегда стартует с `start_time` | producer-pal `playback-and-sends.md` | Учесть при NEXT из остановленного состояния |
| Playhead не может уйти дальше конца песни | producer-pal `locator-updates.ts` | NEXT/импорт: цель за `song_length` — ошибка валидации |
| Прыжок сделан как stop → `set current_song_time` → 100 мс → start | [LFO-lab/SIGNe](https://github.com/LFO-lab/SIGNe) `JumpTransportToObject.maxpat` | Только как аварийный «SAFE JUMP» (звук прерывается); на сцене по умолчанию не используется |
| `set current_song_time` во время игры для сетлиста без учёта квантизации; используется несуществующее свойство `is_arrangement_done_or_recording` | [Emmanuelakpadia/Abletrack-setlist-claude](https://github.com/Emmanuelakpadia/Abletrack-setlist-claude) | Пример того, как делать **не** надо; не используется |
