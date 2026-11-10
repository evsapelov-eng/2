# NØIZ — матрица приёмки A01–A26

Статусы: **PASS / FAIL / NOT TESTED**. «Static proxy» — проверено автотестом или офлайн-моделью, что **не заменяет** host-проверку (ТЗ §15: unit tests не имеют права заменять host validated). Колонка «Host» заполняется после проверки в Live по `HOST_TEST_GUIDE.md`.

Версия: 0.2.0 · дата: 2026-11-10 · Live/Max на стороне разработки: нет.

| ID | Проверка | Static proxy (доказательство) | Host (Live 12) |
|---|---|---|---|
| A01 | .amxd на MIDI-дорожке как Instrument | PASS (статически): `dist/NOIZ/NØIZ.amxd` — контейнер `ampf`, тип `iiii`, есть `plugout~` (`amxd.test.js`); собран скриптом, не штатным Save | NOT TESTED |
| A02 | чистый компьютер, freeze | — | NOT TESTED |
| A03 | звук без MIDI-нот от транспорта | PASS: `max_adapter.test.js` — тики `transport` → `trig` | NOT TESTED |
| A04 | 4 разных тембра | PASS: `render_voices.js` — центроид/decay различаются ≥ 25% попарно | NOT TESTED |
| A05 | каждый макрос 0–100% слышим | PASS: все 4 макроса + RESO/ATTACK/CHARACTER/PAN на 4 голосах в эталонной модели; каждый вход патча влияет на звук (`voice_patch_sim.test.js`) | NOT TESTED |
| A06 | Generate ×10 | PASS: `generative.test.js` A06 | NOT TESTED |
| A07 | Mutate Amount=0 → без изменений | PASS: `generative.test.js` A07 | NOT TESTED |
| A08 | Mutate ≈15% узнаваемо | PASS: среднее 0.8–4 изменённых шага из 16 | NOT TESTED |
| A09 | Keep / Mutate ×2 / Undo | PASS: `generative.test.js` A09 | NOT TESTED |
| A10 | Lock Rhythm/Sound во всех scope | PASS: 4 теста (RHYTHM/SOUND/PLOCKS/ALL) | NOT TESTED |
| A11 | P-Lock Decay=0 на шаге 7 | PASS: `core_state.test.js` A11, `ui_shim.test.js` STEP mode | NOT TESTED |
| A12 | Random P-Locks Density=0 | PASS | NOT TESTED |
| A13 | Random P-Locks Density=1 | PASS (ритм и базовый звук не меняются) | NOT TESTED |
| A14 | Probability 0 / 100% | PASS: `timing.test.js` A14 | NOT TESTED |
| A15 | Ratchet 4 @120 → 0/31.25/62.5/93.75 мс | PASS | NOT TESTED |
| A16 | 16 vs 13 шагов | PASS | NOT TESTED |
| A17 | 3:4 и 5:4 | PASS (3 шага/500 мс, 5 шагов/500 мс) | NOT TESTED |
| A18 | Tempo 80→160 на ходу | PASS: без дублей и пропусков, позиция сохранена | NOT TESTED |
| A19 | loop / seek / stop-start | PASS: lookahead + петля + flush (симуляция с джиттером 25 мс) | NOT TESTED |
| A20 | Save / reopen Live Set | PASS (только сериализация и `getvalueof/setvalueof`) | NOT TESTED — главный риск: Blob-параметр (`MAX_API_TO_VERIFY.md` #7–8) |
| A21 | Full editor close/reopen | — (полный редактор — P6) | NOT TESTED |
| A22 | 4 ноды: drag, Shift, double-click | PASS: `ui_shim.test.js` (один gesture = одна запись Undo) | NOT TESTED |
| A23 | Аудиореактивный клубок | — (P7, после стабильного DSP) | NOT TESTED |
| A24 | Выключить анимацию → звук тот же | — (P7) | NOT TESTED |
| A25 | 4 голоса + ratchet 8 + Drive 100% | PASS: эталонная модель, пик 0.939 < 1 | NOT TESTED |
| A26 | UI в типичной ширине устройства | PASS (статически): presentation ≤ 169 px, `devicewidth` 760 | NOT TESTED |

## Статусы стадий (ТЗ §16)

| Статус | Значение сейчас |
|---|---|
| STATIC VALID | **PASS** — 82 автотеста (в т.ч. исполнение патчей голосов в `tools/maxsim.js`), 38 DSP-проверок, 6 патчей без ошибок связей |
| MAX LOAD VALID | NOT TESTED |
| LIVE LOAD VALID | NOT TESTED |
| AUDIO VALID | NOT TESTED |
| UI VALID | NOT TESTED (превью `renders/ui_preview_*.png` — отрисовка кода jsui через SVG-шим, **не** скриншот Max) |
| RELEASE READY | NO |
