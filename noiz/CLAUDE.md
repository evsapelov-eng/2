# NØIZ — инструкции для Claude Code

Первоисточник: `docs/NOIZ_MASTER_SPEC.md`. Решения по противоречиям: `docs/DECISIONS.md` — не пересматривать без причины.

## Правила

- Название только **NØIZ** (в UI Ø рисуется геометрией в `noiz_ui.js`).
- Никогда не генерировать и не «оборачивать» `.amxd` вручную. Устройство создаётся только штатным Save в Live.
- Статусы не подменять: STATIC VALID ≠ MAX LOAD ≠ LIVE LOAD ≠ AUDIO ≠ UI VALID. Обновлять `docs/ACCEPTANCE_TESTS.md`.
- `js/src/*` и `js/ui/*` — строго ES5 (legacy JS Max): без `let/const`, стрелок, классов, шаблонных строк, `Math.imul`, `Math.random`. `npm run build` это проверяет.
- Вся случайность — `NoizRng` с seed. Никакой случайности в DSP и UI.
- `max/*.maxpat` и `max/*.js` — сгенерированные файлы: править генераторы (`tools/build_patches.py`, `js/`), затем `npm run build && npm run patches && npm run validate`.
- Любой новый контрол — только с записью в `docs/CONTROL_AUDIT.md` (5 вопросов §17).
- Шаги в коде 0-based, в UI 1-based.

## Перед коммитом

```bash
npm run build && npm run patches && npm run validate && npm test
```
