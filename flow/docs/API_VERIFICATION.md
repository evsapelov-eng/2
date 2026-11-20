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
