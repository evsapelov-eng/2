# CHANGELOG

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
