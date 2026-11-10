# KØRE — generative multi-kick techno drum synthesizer (Max for Live Instrument)

Шесть ролей — **PUNCH · SUB · RUMBLE · TOM L · TOM H · HAT** — и генератор техно-грува: один клик GENERATE даёт пробивную основу 4/4 и взаимодействующие голоса вокруг неё; MUTATE варьирует, KEEP фиксирует. Семейство NØIZ. Ableton Live 12, macOS.

> **Статус v0.2.0: STATIC VALID + тестовая сборка. Не релиз.** Код, DSP-патчи и интерфейс проверены автотестами и симуляцией патчей; загрузка и звук в Live — NOT TESTED.

## Быстрый старт

Скачайте **`dist/KORE_v0.2.0_test_build.zip`**, распакуйте папку `KORE` целиком, перетащите `KØRE.amxd` на MIDI-дорожку, Play. Затем один раз **Freeze** (Edit → снежинка → Cmd+S) — после этого `.amxd` самодостаточный. Подробно: `dist/KORE/README_FIRST.txt`.

## Что внутри

| Путь | Что |
|---|---|
| `max/` | сгенерированные патчи: main, плеер бочки `kore_kick` (точность до сэмпла), 4 голоса, шина RUMBLE; `kore_engine.js`, `kore_ui.js` |
| `js/src/` | ядро: модель, планировщик, генератор, движок |
| `js/shared/kore_dsp_model.js` | модель голосов: картинка в UI и офлайн-проверки |
| `spec/dsp_map.json` | параметры → DSP |
| `tests/` | 68 тестов |
| `tools/` | генератор/валидатор патчей, симулятор MSP, офлайн-рендер, упаковка `.amxd` |
| `docs/` | ТЗ, решения, архитектура, план, приёмка A01–A36, проверка в Live |

## Разработка

```bash
cd kore
npm run dist     # build JS + patches + validate + .amxd/zip
npm test         # 80 tests
npm run render   # renders/kore_demo_130bpm.wav + low-end/headroom checks
```
