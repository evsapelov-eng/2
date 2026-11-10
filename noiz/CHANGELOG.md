# Changelog

## 0.2.0 — 2026-11-10 (test build, not host-tested)

- Упрощённый интерфейс: экраны SEQ / SYNTH, GENERATE/MUTATE по контексту экрана; удалены RHY/SND/PLK/ALL, LK DENS/AMT, DENS, R/S, BASE; одна кнопка L (защита голоса).
- Панорама: PAN как P-Lock-параметр, SPREAD (разброс по ударам, ratchet пролетает по стерео), генерация панорамы; панорама равной мощности в каждом экземпляре голоса.
- Модуль синтеза SYNTH: RESO, ATTACK, CHARACTER (HISS BODY, DUST GRAIN, METAL RATIO, ATMOS WIDTH), PAN, SPREAD, LEVEL + 4 макроса; превью огибающей; значения в Гц/мс/дБ/L-R.
- Схема данных v2 с миграцией v1.
- `tools/maxsim.js`: исполнение сгенерированных патчей голосов — каждый из 9 входов доказуемо влияет на звук.
- 82 автотеста, 38 проверок эталонной DSP-модели.

## 0.1.1 — 2026-11-10 (test build, not host-tested)

- Готовые к перетаскиванию устройства: `dist/NOIZ/NØIZ.amxd` и `NØIZ P1 hello.amxd` + зависимости, zip. Собраны скриптом (`tools/build_amxd.py`), не штатным Save, не Freeze (D21).
- Исправлено: `[expr]` делил целые константы нацело (`9000/700` = 12) — диапазоны TONE/DECAY в голосах были искажены.
- Исправлено: `mgraphics.set_font_weight` (может отсутствовать в Max) → `select_font_face("Arial Bold")`; ошибки отрисовки показываются на устройстве и в Max Console.
- UI показывает такт.доля при игре (диагностика синхронизации).
- Сборка JS для Max — только ASCII (не-ASCII экранируется).

## 0.1.0 — 2026-11-10 (STATIC VALID, not host-tested)

- Ядро (ES5): модель состояния schema v1 (4 × 32 шага, P-Locks как Partial<sound>), нормализация, versioned сериализация с безопасным отказом.
- Планировщик по абсолютной позиции Live: Length, Division n:m, Probability (детерминированный hash), Ratchet с минимальным интервалом; lookahead 40 мс + `[pipe]`, учёт петли Live, flush на seek/stop.
- Generate (архетипы голосов, density, полиметрия не в каждом паттерне, ограничение 4-голосных стеков), Mutate от Keep anchor, Keep, Undo(16), locks Rhythm/Sound, random P-Locks (Lock Density / Lock Amount), применение на следующем такте при игре.
- DSP-граф 4 голосов (`spec/dsp_map.json`), poly~ на удар, мягкая защита мастера; эталонный офлайн-рендер с 22 проверками.
- Генератор и валидатор `.maxpat`; P1 hello-патч; диагностический jsui 760 × 169.
- 55 автотестов. Документация: решения, архитектура, план, приёмка A01–A26, инструкция для Live, API к проверке.
