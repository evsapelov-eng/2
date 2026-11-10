# KØRE — архитектура v0.1

```
Live transport → [qmetro 10]→[transport]→ tick ─┐      live.observer loop ─┐
                                               ▼                          ▼
 compact jsui / editor jsui ──commands──► [js kore_engine.js]  (state · KEEP · UNDO · seeded RNG ·
                                          │     lookahead scheduler · genre-aware generator)
            Global(kore_ui_N) ◄───────────┤
   trig track amp p0..p4 open delay       ▼
 [unpack]→[pipe … delay]→[pack]→[route 0..5]
   0 PUNCH → [poly~ kore_voice_punch 6] ──┬──────────────► Σ
              └─ hit bang ─► SUB duck, RUMBLE duck          │
   1 SUB   → [poly~ kore_voice_sub 3] → ×duck ───────────► Σ
   2 RUMBLE step → [kore_rumble] ◄── PUNCH audio ────────► Σ
   3/4 TOM L/H → [poly~ … 4] ────────────────────────────► Σ
   5 HAT  → [poly~ kore_voice_hat 1 @steal 1] (choke) ───► Σ
 Σ → DC block 15 Hz → tanh soft safety · ceiling 0.94 → [plugout~] L=R (mono low end)
   └ [peakamp~ 33] → meter / kickmeter → engine → UI (telemetry only)
 [pattr kore_state] = Live Blob parameter (state + KEEP anchor + seed)
```

Голос PUNCH: `line~(dB) → dbtoa~ → ×(semis/12·6.0206) → dbtoa~ → ×f0 → cycle~(phase 0.75 on note)` × огибающая `line~(dB)→dbtoa~` × gate; + клик `noise~→svf~ HP→линейный 5 мс`; → drive `tanh(g·x)·g^−0.3` → ×amp.

Генератор: PUNCH 4/4 → SUB ответы (HYBRID/ALTERNATE/LAYER) → RUMBLE гейты (offbeat/kick/sparse/pulse) → TOM L/H мотивы → HAT офбиты + 16-е по стилю → валидация (якорь, ≤1 тройной LF-стек, плотность), до 16 попыток, затем FOUNDATION. Затем звук (архетипы) и рисунки по шагам.

Ограничения: те же, что у NØIZ (первый удар после Play до ~35 мс, такт 4/4, точность — квант планировщика Max); редактор-окно — механизм открытия проверяется впервые (K5/K6).
