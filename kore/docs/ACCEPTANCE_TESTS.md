# KØRE — матрица A01–A36

Статусы: PASS / FAIL / NOT TESTED. «Static proxy» — автотест или офлайн-модель; **не заменяет** host-проверку (ТЗ: never PASS from static inspection alone). Host-колонка заполняется в Live. Версия 0.1.0, 2026-11-10, Live/Max на стороне разработки: нет.

| ID | Static proxy | Host |
|---|---|---|
| A01* | `.amxd` = контейнер `ampf`/`iiii`, есть `plugout~` (`amxd.test.js`); собран скриптом | NOT TESTED |
| A02* | патч PUNCH звучит и освобождает экземпляр (`patch_sim`) | NOT TESTED |
| A03* | патч PUNCH: устоявшаяся частота = TUNE ±6% (3 значения) | NOT TESTED |
| A04* | PUNCH меняет onset-частоту в 1.5+ раза, пик ±25% | NOT TESTED |
| A05* | DECAY меняет хвост; патч = модель ±5% | NOT TESTED |
| A06* | DRIVE снижает crest, пик ≤ ×1.2 | NOT TESTED |
| A07 | CLICK: ВЧ-энергия атаки ×3, высота та же | NOT TESTED |
| A08* | SUB патч звучит, TUNE работает | NOT TESTED |
| A09* | ALTERNATE: SUB не на шагах бочки (50 генераций) | NOT TESTED |
| A10* | наложение PUNCH+SUB на 0 дБ: −3.1 dBFS | NOT TESTED |
| A11* | SUB-duck активен ~21% времени, только вокруг ударов | NOT TESTED |
| A12 | RUMBLE: 6 с при макс. tail ограничен, fb ≤ 0.85 | NOT TESTED |
| A13 | удар PUNCH приглушает хвост RUMBLE (>×2) | NOT TESTED |
| A14 | TOM H выше TOM L (×1.4+) | NOT TESTED |
| A15 | open ×3 длиннее closed; closed обрывает open (<5% энергии) | NOT TESTED |
| A16* | 6 дорожек, длина 1–32 (тайминг-тесты) | NOT TESTED |
| A17* | 4/4 на 0/4/8/12 при 130 BPM (`max_adapter.test.js`) | NOT TESTED |
| A18* | 16/13/7 независимы | NOT TESTED |
| A19* | 3:4/5:4/7:4 — реальные интервалы | NOT TESTED |
| A20* | смена темпа без дублей/дрейфа | NOT TESTED |
| A21* | петля/seek/stop-start без дублей (lookahead + flush) | NOT TESTED |
| A22 | ratchet внутри шага, минимальный интервал 12 мс | NOT TESTED |
| A23 | probability 0/1, детерминизм | NOT TESTED |
| A24* | 1000 генераций FOUNDATION/DRIVING/HYPNOTIC: якорь 0/4/8/12 | NOT TESTED |
| A25 | стили различаются (плотность HAT, нечётные длины, n:m) | NOT TESTED |
| A26 | BROKEN + unlock: якорь двигается в 20–90% генераций, даунбит на месте | NOT TESTED |
| A27* | тот же seed → тот же паттерн с P-Locks, после restore | NOT TESTED |
| A28* | AMOUNT 0 = no-op; 15% сохраняет 4/4, звук бочки < 1% | NOT TESTED |
| A29* | 8 MUTATE подряд — 8 разных вариаций | NOT TESTED |
| A30* | KEEP/UNDO точно | NOT TESTED |
| A31* | P-Lock только своего шага и своего голоса | NOT TESTED |
| A32* | плотность 0 → нет P-Locks; 1 → на всех шагах | NOT TESTED |
| A33* | редактор: `p KORE_EDITOR` + pcontrol в патче; UI-шим обоих режимов | NOT TESTED |
| A34* | ноды: один gesture, значения меняются (UI-шим) | NOT TESTED |
| A35* | сериализация/restore, отказ чужого формата | NOT TESTED |
| A36* | худший случай −0.6 dBFS, без NaN; Freeze — только в Max | NOT TESTED |

## Статусы стадий
STATIC VALID: **PASS** (68 тестов, 5 офлайн-проверок, 7 патчей) · MAX LOAD / LIVE LOAD / AUDIO / UI VALID: NOT TESTED · RELEASE READY: NO
