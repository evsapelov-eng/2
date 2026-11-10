# KØRE — инструкции для Claude Code

Первоисточник: `docs/KORE_MASTER_SPEC.md`; решения пользователя D1–D5 в `docs/DECISIONS.md` имеют приоритет над ТЗ.

- Название только KØRE (Ø рисуется геометрией в UI).
- `.amxd` из `tools/build_amxd.py` — тестовая сборка, не штатный Save; финальная — Freeze в Max.
- `js/src`, `js/ui`, `js/shared` — строго ES5 (сборка проверяет). Случайность — только `KoreRng`.
- `max/*` генерируются: правьте `tools/build_patches.py`, `spec/dsp_map.json`, `js/`.
- Модель голоса `js/shared/kore_dsp_model.js` и патчи должны совпадать (`tests/patch_sim.test.js`).
- Перед коммитом: `npm run dist && npm test && npm run render`.
