# FLOW — Performance Arranger (Max for Live)

Max for Live MIDI Effect для Ableton Live 12: HOLD / RELEASE / NEXT / PREV / STOP по секциям Arrangement во время концерта. Полное ТЗ — [`docs/SPEC_RU.md`](docs/SPEC_RU.md).

> **Статус: Milestone 1, версия 0.2.0-m1 — UNVERIFIED.** Устройство и все функции движка написаны и проверены 88 автотестами на симуляторе Live. В самом Ableton FLOW ещё не запускался: среда разработки — Linux без Ableton. Следующий шаг — один прогон **SELF-TEST** на вашем Mac. До этого не используйте FLOW на концерте.

## Начать (Mac + Ableton Live 12 Suite)

1. Скачайте архив: `https://github.com/evsapelov-eng/2/archive/refs/heads/claude/relaxed-maxwell-e14m05.zip`
2. Из папки `flow/dist/` скопируйте **оба** файла `FLOW.amxd` и `flow.js` в одну папку.
3. Перетащите `FLOW.amxd` на MIDI-дорожку **копии** сета и сохраните сет.
4. Нажмите `self_test` дважды, подождите 1,5–3 минуты.
5. Пришлите файл `FLOW-SelfTest-*.txt`, который появится рядом с сетом.

Подробно: [`docs/USER_GUIDE_RU.md`](docs/USER_GUIDE_RU.md).

## Структура

```text
flow/
├─ src/                 исходники (ES5, работают и в Max, и в Node)
│   sections.js         модель секций / сетлиста / JSON / локаторы
│   engine.js           движок HOLD/RELEASE/NEXT/PREV/STOP
│   selftest.js         SELF-TEST и калибровка
│   main.js             связь с Live API, UI, хранение
├─ device/flow/         сгенерированные flow.js (бандл) и FLOW.maxpat
├─ dist/                FLOW.amxd + flow.js — то, что ставится в Live
├─ device/m0-spike/, dist/FLOW-M0-Spike.amxd   диагностическое spike-устройство M0
├─ tools/               build_flow.py, build_m0_spike.py
├─ tests/               симулятор Live + 88 тестов
└─ docs/                USER_GUIDE_RU, ARCHITECTURE, API_VERIFICATION, TEST_PLAN, TEST_RESULTS, RISKS, M0 protocol
```

## Разработка

```bash
cd flow
npm run build   # собрать оба устройства из исходников
npm test        # сборка + 88 тестов
```

Автотесты проверяют логику FLOW. Поведение Live измеряет SELF-TEST на компьютере пользователя.

## Дорожная карта (§20 ТЗ)

| Этап | Содержание | Статус |
|---|---|---|
| M0 | Проверка Live API | заменена встроенным SELF-TEST (S1–S7); spike сохранён для диагностики |
| M1 | Engine: состояния, секции, HOLD/RELEASE/NEXT/PREV, SELF-TEST | **код готов, UNVERIFIED** — ждёт отчёта SELF-TEST |
| M2 | Графический редактор ARRANGE (таймлайн, drag-and-drop сетлиста) | не начат |
| M3 | Окно PERFORM, MIDI Learn, LED-обратная связь | частично: MIDI Map, конфликты, READ-ONLY уже в M1 |
| M4 | Digitone II Program Change | не начат (модель A01–H16 ↔ PC готова) |
| M5 | Готовность к сцене, стресс-тест 60–90 мин | не начат |
