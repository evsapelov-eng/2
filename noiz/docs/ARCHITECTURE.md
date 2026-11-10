# NØIZ — архитектура v0.1

```
Live 12 transport ──► [qmetro 10] → [transport] → tick bars beats units res tempo ─┐
Live loop (LOM)   ──► [live.observer loop / loop_start / loop_length] ─────────────┤
                                                                                   ▼
                      ┌──────────── [js noiz_engine.js]  (low priority) ───────────┐
 jsui commands ─────► │ NoizEngine: state · Keep anchor · Undo(16) · seeded RNG    │
                      │ NoizClock: lookahead 40 ms, loop-aware, flush on seek/stop │
                      │ noizEventsInRange(): pure, absolute-position scheduler     │
                      └─┬─────────────────────────────┬────────────────┬──────────┘
          trig t amp tone decay tex drive delayMs     │ Global(noiz_ui_N) + refresh/playhead
                        ▼                             ▼                ▼
        [unpack] → [pipe … delay] (high priority)   [deferlow] → [jsui noiz_ui.js]
                        ▼                                               │ commands
        [route 0 1 2 3] → [poly~ noiz_voice_<v> 8 @steal 1] ×4          └──────► engine
                        ▼
        Σ L/R → [tanh~] soft safety · ceiling 0.94 → [plugout~]
        [pattr noiz_state @bindto engine]  = Live Blob parameter (Stored Only)
```

## Слои (§04)

| Слой | Где | Правило |
|---|---|---|
| DSP | `max/noiz_voice_*.maxpat` (poly~), master в `noiz_main.maxpat` | только MSP; никакой случайности паттернов, сериализации или JS в аудиопотоке |
| Clock / events | `js/src/20_scheduler.js` | позиция — абсолютная музыкальная фаза из Live; probability = hash(seed, track, cycle, step, kind) |
| Model / state | `js/src/10_model.js`, `40_engine.js` | единственный источник истины; UI только шлёт команды |
| Generative | `js/src/30_generator.js` | архетипы голосов, density, контраст velocity, ограничение 4-голосных стеков |
| UI | `js/ui/noiz_ui.js` (jsui, mgraphics) | читает опубликованное состояние, перерисовка ≤ 30 fps и только при изменении |
| Bridge | сообщения `tick/generate/macro/...` → engine; `trig/flush` → DSP; `bind/refresh/playhead` → UI | UI-таймер и аудиочасы не смешиваются |

## Почему lookahead (D15)

`[js]` всегда выполняется в низкоприоритетном потоке Max. Если запускать удар прямо из JS, любая нагрузка на интерфейс сдвигает ритм. Поэтому JS только **планирует**: на каждом опросе (~10 мс, `qmetro` → свежая позиция в момент выполнения JS) он выдаёт все события до `позиция + 40 мс` с задержкой `delayMs`. `[pipe]` работает в планировщике Max (в M4L — в аудиопотоке, с квантованием по аудиовектору) и выпускает их вовремя. Джиттер JS до 40 мс поглощается полностью — это проверено тестом с симулированным джиттером 25 мс (`tests/timing.test.js`).

Петля Live: если она включена и плейхед внутри, расписание заворачивается на loop end → за концом петли ничего не ставится в очередь. Seek/неожиданный скачок → `flush` → `[pipe] clear`, расписание заново от новой позиции. Stop → `flush`.

## Известные ограничения v0.1

1. Первый удар сразу после нажатия Play приходит с опозданием до одного опроса (≈ 10–35 мс): старт транспорта JS замечает только на опросе. Дальше — точно.
2. Точность — квант планировщика Max (аудиовектор в M4L), не sample-accurate. Sample-accurate путь (gen~-секвенсор) — кандидат на после-v1, только с измерением.
3. Размер такта для «применить на следующем такте» — 4/4 (D9).
4. Остановка: до 40 мс уже запланированных событий могут прозвучать после Stop (flush срабатывает на детекции остановки).
5. Изменения паттерна при игре влияют на события дальше горизонта 40 мс.
