# NØIZ — план P0–P8 и текущее состояние

| Стадия | Содержание | Сделано в v0.1 | Ворота (Done) | Статус |
|---|---|---|---|---|
| P0 | окружение, стек | `ENVIRONMENT.md`, `DECISIONS.md`, `MAX_API_TO_VERIFY.md` | матрица окружения заполнена пользователем | частично (ждёт версий Live/Max) |
| P1 | host-valid hello Instrument | `max/p1_hello_hiss.maxpat` (без JS) + инструкция | звук в Live, Console чистая, штатный Save | **ждёт проверки в Live** |
| P2 | 4 голоса + макросы | `noiz_voice_*.maxpat` (poly~), `spec/dsp_map.json`, эталонный рендер + 22 проверки | каждый голос и макрос слышим в Live | исходники готовы, NOT TESTED |
| P3 | секвенсор + Live sync | `20_scheduler.js` (lookahead, петля, seek/stop), тест-векторы | тест-векторы 120 BPM в Live | исходники готовы, NOT TESTED |
| P4 | P-Locks + Generate/Mutate/Keep/Undo | `30_generator.js`, `40_engine.js`, ≥ 20 тестов (сейчас 55 всего) | одинаковый seed → одинаковый результат; locks в ALL | static PASS, NOT TESTED |
| P5 | Compact UI ≤ 169 px | диагностический jsui 760×169 (помечен DIAGNOSTIC) | Compact ≤ 640 px по эскизу + кнопка OPEN | следующий шаг после host-проверки |
| P6 | Full UI (Sequence + Sound) | — | эскизы, BASE/STEP, 100/125%/HiDPI | не начат |
| P7 | аудиореактивность | — (ноды пока статичны, форма = значение) | реальные метрики сигнала, reduced motion | не начат |
| P8 | Freeze, доставка | — | чистое переоткрытие | не начат |

## Порядок дальше

1. Пользователь проходит `HOST_TEST_GUIDE.md` шаги 0–2 и присылает Console + PASS/FAIL.
2. Исправления по `MAX_API_TO_VERIFY.md` (если что-то из 15 пунктов отличается).
3. Подстройка звука по слуху (`spec/dsp_map.json` → `npm run patches`).
4. P5: финальный Compact по `assets/NOIZ_COMPACT_wireframe.png` + окно полного редактора (механизм открытия проверяется в Max + Live).
5. P6 → P7 → P8.

## Задачи, отложенные сознательно

- live.* параметры для автоматизации/MIDI-маппинга главных контролов (SHOULD): AMOUNT, GENERATE/MUTATE как кнопки, Level/Mute голосов.
- Bank/presets, snapshot A/B (SHOULD).
- Swing, Reverse/Ping-Pong, Euclidean, multi-out (LATER) — на главный экран не выводятся (§03).
