# NØIZ — generative percussion synthesizer (Max for Live Instrument)

Четыре синтезированных шумовых голоса (HISS · DUST · METAL · ATMOS) с модулем синтеза и панорамой на каждый удар, секвенсор 4 × 32 шага с независимыми Length / Division n:m, Probability, Ratchet и P-Locks на каждом шаге, Generate / Mutate / Keep / Undo на seeded RNG. Ableton Live 12, macOS.

> **Статус v0.4.1: STATIC VALID + тестовая сборка `.amxd`. Не релиз.** Ядро, DSP-граф и патчи написаны и проверены автотестами в среде без Ableton/Max. Загрузка в Max и Live, звук и интерфейс в Live — **NOT TESTED**. `.amxd` в репозитории нет намеренно: он собирается штатным Save в Live по `docs/HOST_TEST_GUIDE.md`.

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
| `tests/` | 102 автотеста (Node, без зависимостей) |
| `tools/` | генератор патчей, валидатор, эталонный рендер звука |
| `dist/NOIZ/` | тестовая сборка: `NØIZ.amxd`, `NØIZ P1 hello.amxd` + зависимости; zip рядом |
| `docs/` | ТЗ, решения, архитектура, план, приёмка, инструкция для Live |

## Быстрый старт — тестовая сборка

Скачайте **`dist/NOIZ_v0.4.1_test_build.zip`**, распакуйте папку `NOIZ` целиком, перетащите `NØIZ.amxd` на MIDI-дорожку Live 12, нажмите Play. Сначала можно проверить `NØIZ P1 hello.amxd` (кнопка → «пшик»). Инструкция и что делать при проблемах — `dist/NOIZ/README_FIRST.txt`.

Сборка создана скриптом (`npm run dist`), не штатным Save в Live и не заморожена — в Live пока не проверялась.

## Штатная сборка в Live (если тестовая не открывается)

Пошагово: **[`docs/HOST_TEST_GUIDE.md`](docs/HOST_TEST_GUIDE.md)**. Коротко:

1. P1: создать *Max Instrument* в Live, вставить `p1_hello_hiss.maxpat`, Save → кнопка TRIG шипит.
2. Полное устройство: новый *Max Instrument*, *Save As* `NOIZ.amxd` в папку `noiz/max/`, вставить `noiz_main.maxpat`, включить *Open in Presentation*, Save.
3. Play в Live → играет встроенный паттерн → GENERATE / MUTATE / KEEP / UNDO.

## Управление (760 × 169, три экрана)

- **GENERATE** меняет всё (ритм, звук, синтез, панорама, значения по шагам) у всех голосов, кроме защищённых **L**; **MUTATE** — вариация от KEEP с силой AMOUNT.
- **SEQ:** клик по шагу — вкл/выкл; **option+клик** — режим STEP (значения шага; VEL/PROB/RAT слева; «x» выход; CLR стереть); M mute; L защита; LEN/DIV.
- **LANE:** голос + один из 9 параметров → рисовать значения по 16 шагам; option-клик/двойной клик — вернуть значение голоса.
- **SYNTH:** 10 нод выбранного голоса (или выбранного шага); сверху картинка из модели звука — волна L/R, 10 мс крупно, спектр, панорама/разброс. У каждой ноды свой знак (TONE — частые волны, DECAY — длина дуги, TEXTURE — зерно, DRIVE — квадрат, RESO — кольца, ATTACK — наклон, PAN — точка, SPREAD — разброс, LEVEL — размер).

## Разработка

```bash
cd noiz
npm test              # 55 тестов ядра, адаптера Max и UI-шима
npm run build         # js/src + adapter → max/noiz_engine.js, max/noiz_ui.js
npm run patches       # spec/dsp_map.json → max/*.maxpat
npm run validate      # статическая проверка патчей
npm run dist          # всё выше + dist/NOIZ/*.amxd и zip
npm run render        # эталонный рендер голосов и демо-грува → renders/*.wav + report.json
```

Звук подстраивается в `spec/dsp_map.json` → `npm run patches` (и `npm run render`, чтобы проверить, что макросы остались слышимыми).

## Известные ограничения

См. `docs/ARCHITECTURE.md` («Известные ограничения») и `docs/MAX_API_TO_VERIFY.md`. Главное: первый удар после Play может опоздать на ~10–35 мс; v1 считает такт 4/4; сохранение в Live Set через Blob-параметр требует проверки (A20).
