# FLOW — Performance Arranger (Max for Live)

Max for Live MIDI Effect для Ableton Live 12, который управляет структурой Arrangement на концерте: HOLD / RELEASE / NEXT / PREVIOUS / STOP. По желанию он отправляет Program Change в Elektron Digitone II. Полное ТЗ — [`docs/SPEC_RU.md`](docs/SPEC_RU.md).

> **Текущий статус: Milestone 0 — UNVERIFIED.** В репозитории пока только измерительное spike-устройство. Это **не** FLOW и не инструмент для сцены. Его ни разу не запускали в Live: среда разработки не имеет Ableton/Max. Следующий шаг — прогон протокола на вашем Mac.

## Структура

```text
flow/
├─ device/m0-spike/
│   ├─ flow_spike.js        исходник устройства (Max js, ES5)
│   └─ flow-spike.maxpat    патч (генерируется)
├─ dist/
│   ├─ FLOW-M0-Spike.amxd   Max MIDI Effect (генерируется; UNVERIFIED)
│   └─ flow_spike.js        копия скрипта — должна лежать рядом с .amxd
├─ tools/build_m0_spike.py  генератор .maxpat/.amxd
├─ tests/                   симулятор Live + автотесты (Node)
└─ docs/
    ├─ M0_SPIKE_PROTOCOL.md  ← что сделать в Ableton (начните отсюда)
    ├─ API_VERIFICATION.md   какие методы Live API подтверждены документацией/запуском
    ├─ ARCHITECTURE.md       черновик архитектуры и гипотезы M0
    ├─ TEST_PLAN.md / TEST_RESULTS.md
    ├─ RISKS.md
    └─ SPEC_RU.md            исходное ТЗ
```

## Быстрый старт (Mac + Ableton Live 12 Suite)

1. Скопируйте папку `flow/dist/` целиком (например, в User Library).
2. Перетащите `FLOW-M0-Spike.amxd` на MIDI-дорожку.
3. Если устройство не открылось, соберите его вручную (вариант B в [`docs/M0_SPIKE_PROTOCOL.md`](docs/M0_SPIKE_PROTOCOL.md#вариант-b--ручная-сборка-если-a-не-открылся-или-пишет-ошибку)).
4. Выполните эксперименты E0–E13 из протокола, нажмите `save log` и передайте лог.

Устройство пропускает MIDI дорожки насквозь. Транспорт и Loop оно меняет только по нажатию кнопок, при загрузке ничего не трогает.

## Разработка

Требуются Python 3 и Node ≥ 20.

```bash
cd flow
npm run build   # пересобрать .maxpat и dist/*.amxd из исходников
npm test        # сборка + 28 автотестов (логика на симуляторе, проверка патча)
```

Автотесты проверяют только собственную логику FLOW. Поведение Live они **не** доказывают. См. [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

## Дорожная карта (§20 ТЗ)

| Этап | Содержание | Статус |
|---|---|---|
| M0 | API feasibility spike | код готов, **UNVERIFIED** (ждёт прогона в Live) |
| M1 | Engine: state machine, секции, HOLD/RELEASE/NEXT | не начат — зависит от результатов M0 |
| M2 | ARRANGE UI, импорт локаторов, сохранение | не начат |
| M3 | PERFORM, MIDI-контроллер, конфликты | не начат |
| M4 | Digitone adapter | не начат |
| M5 | Stage readiness | не начат |
