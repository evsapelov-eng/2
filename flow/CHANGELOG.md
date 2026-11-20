# CHANGELOG

## [0.2.0-m1] — 2026-11-20 — UNVERIFIED (в Live не запускалась)

### Добавлено
- **FLOW device** `dist/FLOW.amxd` + `dist/flow.js` (генерируется `tools/build_flow.py` из `src/`).
- `src/sections.js`: секции, сетлист с повторами, валидация, JSON (schemaVersion 1), хранение в Live Set (`FLOW1:` + URL-кодированный JSON), импорт локаторов с явным `END`, Digitone A01–H16 ↔ PC 0–127, undo/redo.
- `src/engine.js`: состояния §5; HOLD (секция / последние N тактов), RELEASE с EXIT NEXT CYCLE, NEXT/PREV по сетлисту или координатам, механизмы LOOP WRAP / LOCATOR JUMP / LINEAR / TIMED SEEK (EXPERIMENTAL), авто-переход по сетлисту и PAUSE, STOP с подтверждением, CANCEL, MANUAL OVERRIDE, ERROR по тайм-ауту подтверждения, BACK TO ARRANGEMENT, debounce.
- `src/selftest.js`: SELF-TEST одной кнопкой (S0–S8), калибровка `safeLeadMs`, отчёт рядом с `.als`.
- `src/main.js`: мост LiveAPI, UI, хранение в pattr, JSON export/import, реестр мастер-экземпляра (READ-ONLY / TAKE OVER).
- Панель: HOLD / RELEASE / PREV / NEXT / STOP / CANCEL (MIDI Map), 6 меню опций, служебные кнопки.
- `docs/USER_GUIDE_RU.md`.
- Тесты: 88 (модель, движок в собранном бандле, SELF-TEST, патч, spike).

### Исправлено в ходе разработки (найдено тестами)
- Обработчики RELEASE/NEXT получали позицию вместо операции.
- Гонка: стоп транспорта, пока `loop=1` ещё не применён, оставлял петлю включённой.
- CANCEL не отменял прыжок через петлю, хотя время до границы ещё было.
- Авто-переход сетлиста блокировал ручной HOLD в конце секции.
- Повторная запись уже установленного значения петли ждала подтверждения, которого Live не присылает, и вела в ERROR.


## [m0-spike 0.1.1] — 2026-11-20 — UNVERIFIED

### Изменено (по результатам изучения открытых проектов и эталонов Ableton)
- `.amxd`: служебные поля патча (`openrect`, `project.amxdtype`, `latency`, `is_mpe`…) приведены к файлам, сохранённым самим Max (репозиторий Ableton/maxdevtools); заголовок сверен побайтово.
- HOLD-эксперимент: `loop` подтверждается уведомлением Live, а не мгновенным чтением (Live отдаёт старое значение ~25 мс); границы проверяются сразу.
- Сравнение позиций с допуском 1e-4 (Live хранит 32-битные float).
- Симулятор: границы петли применяются синхронно, `loop`/позиция/транспорт — асинхронно.
- Тестов: 30.

## [m0-spike 0.1.0] — 2026-11-20 — UNVERIFIED

Milestone 0: API feasibility spike. В Ableton Live не запускался.

### Добавлено
- `device/m0-spike/flow_spike.js`: измерительное устройство (Max classic js, ES5).
  - Чтение Song (`current_song_time`, `is_playing`, `loop*`, `tempo`, размер, `back_to_arranger`, квантизация) и `cue_points` (name/time).
  - Команды: loop on/off, setloop, seek, cue jump, play/stop, back to arrangement, restore снимка Loop.
  - Эксперименты E1–E10: частота observer/опроса/Task, арифметика тактов, HOLD, RELEASE, sweep запаса RELEASE, sweep позднего HOLD (включая «после границы»), seek, CuePoint.jump, нативный прыжок назад через петлю, запрет set из колбэка.
  - Лог с отметками времени, `save log` в текстовый файл.
- `tools/build_m0_spike.py`: генерация `flow-spike.maxpat` и `dist/FLOW-M0-Spike.amxd`.
- `tests/`: симулятор транспорта Live/Max js и 28 автотестов (логика + статическая проверка патча).
- Документация: протокол испытаний M0, проверка API по официальной документации, черновик архитектуры, план и результаты тестов, риски.

### Не реализовано (сознательно, ждёт результатов M0)
- FLOW engine, state machine, секции, UI ARRANGE/PERFORM, MIDI-контроллер, Digitone adapter.
