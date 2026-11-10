# NØIZ — generative percussion synthesizer (Max for Live Instrument)

Четыре синтезированных шумовых голоса (HISS · DUST · METAL · ATMOS), секвенсор 4 × 32 шага с независимыми Length / Division n:m, Probability, Ratchet и P-Locks на каждом шаге, Generate / Mutate / Keep / Undo на seeded RNG. Ableton Live 12, macOS.

> **Статус v0.1.0: STATIC VALID. Не готовый плагин.** Ядро, DSP-граф и патчи написаны и проверены автотестами в среде без Ableton/Max. Загрузка в Max и Live, звук и интерфейс в Live — **NOT TESTED**. `.amxd` в репозитории нет намеренно: он собирается штатным Save в Live по `docs/HOST_TEST_GUIDE.md`.

## Что внутри

| Путь | Что |
|---|---|
| `max/p1_hello_hiss.maxpat` | P1: минимальный инструмент без JS — первая проверка в Live |
| `max/noiz_main.maxpat` | главный патч устройства (часы, движок, poly~-голоса, master, UI, сохранение) |
| `max/noiz_voice_{hiss,dust,metal,atmos}.maxpat` | голоса (poly~-экземпляр на удар) |
| `max/noiz_engine.js` | собранный движок для `[js]` (ES5, один файл) |
| `max/noiz_ui.js` | диагностический интерфейс для `[jsui]` |
| `js/src/` | исходники ядра: модель, планировщик, генератор, движок |
| `spec/dsp_map.json` | единая таблица «макрос → DSP» для патчей и эталонного рендера |
| `tests/` | 55 автотестов (Node, без зависимостей) |
| `tools/` | генератор патчей, валидатор, эталонный рендер звука |
| `docs/` | ТЗ, решения, архитектура, план, приёмка, инструкция для Live |

## Установка и первая проверка (Live 12 Suite)

Пошагово: **[`docs/HOST_TEST_GUIDE.md`](docs/HOST_TEST_GUIDE.md)**. Коротко:

1. P1: создать *Max Instrument* в Live, вставить `p1_hello_hiss.maxpat`, Save → кнопка TRIG шипит.
2. Полное устройство: новый *Max Instrument*, *Save As* `NOIZ.amxd` в папку `noiz/max/`, вставить `noiz_main.maxpat`, включить *Open in Presentation*, Save.
3. Play в Live → играет встроенный паттерн → GENERATE / MUTATE / KEEP / UNDO.

## Управление (диагностический UI 760 × 169)

- клик по шагу — вкл/выкл; **option+клик** — выбрать шаг (режим STEP, P-Lock)
- в режиме STEP слева VEL / PROB / RAT шага; CLR — убрать P-Locks шага; BASE — назад
- имя дорожки — выбрать голос; **M** mute, **R** защита ритма, **S** защита звука и P-Locks
- ноды TONE/DECAY/TEXTURE/DRIVE: вертикальное перетаскивание по всей ноде, Shift — точно, двойной клик — по умолчанию
- LEN / DIV / DENS — вертикальное перетаскивание по строке
- RHY/SND/PLK/ALL — область для GENERATE/MUTATE; при PLK/ALL видны LK DENS и LK AMT

## Разработка

```bash
cd noiz
npm test              # 55 тестов ядра, адаптера Max и UI-шима
npm run build         # js/src + adapter → max/noiz_engine.js, max/noiz_ui.js
npm run patches       # spec/dsp_map.json → max/*.maxpat
npm run validate      # статическая проверка патчей
npm run render        # эталонный рендер голосов и демо-грува → renders/*.wav + report.json
```

Звук подстраивается в `spec/dsp_map.json` → `npm run patches` (и `npm run render`, чтобы проверить, что макросы остались слышимыми).

## Известные ограничения

См. `docs/ARCHITECTURE.md` («Известные ограничения») и `docs/MAX_API_TO_VERIFY.md`. Главное: первый удар после Play может опоздать на ~10–35 мс; v1 считает такт 4/4; сохранение в Live Set через Blob-параметр требует проверки (A20).
