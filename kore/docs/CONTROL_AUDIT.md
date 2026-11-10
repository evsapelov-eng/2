# KØRE — контролы (ТЗ: цель / схема / DSP / тест / место)

| Контрол | Связь | Тест |
|---|---|---|
| PUNCH TUNE / PUNCH / DECAY / DRIVE / CLICK | f0 / глубина+τ sweep / огибающая / tanh+комп. / клик | A03–A07 |
| SUB TUNE / DECAY | f0 / огибающая | A08 |
| RUMBLE AMOUNT / TAIL / DUCK | wet / feedback+гейт / глубина приглушения | A12, A13 |
| TOM TUNE / DECAY / TONE | f0 / огибающая / шум-резонанс и q | A14 |
| HAT TONE / DECAY / OPEN (шаг) | HP / огибающая / ×6 и choke | A15 |
| LEVEL (на голос) | dB → amp | — |
| GENERATE / MUTATE / KEEP / UNDO / AMOUNT | движок | A24–A30 |
| STYLE | рецепты генератора | A25 |
| KICK/SUB | правило размещения SUB | A09, A10 |
| M / L | mute / защита от генерации | A10-like |
| LENGTH / RATE / VEL / PROB / RAT | планировщик | A16–A23 |
| LANES | P-Locks по шагам | A31, A32 |
| OPEN EDITOR / CLOSE | pcontrol | A33 |
| Катушка, OUT/KICK | только телеметрия peakamp~, не влияет на звук | `max_adapter.test.js` |

Не выведены (ТЗ §14): BIAS (слит со STYLE), отдельная фаза, FX-матрица, ручки low-end (внутри, безопасные значения).
