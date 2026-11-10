# Changelog

## 0.1.0 — 2026-11-10 (STATIC VALID, not host-tested)

- Ядро (ES5): модель состояния schema v1 (4 × 32 шага, P-Locks как Partial<sound>), нормализация, versioned сериализация с безопасным отказом.
- Планировщик по абсолютной позиции Live: Length, Division n:m, Probability (детерминированный hash), Ratchet с минимальным интервалом; lookahead 40 мс + `[pipe]`, учёт петли Live, flush на seek/stop.
- Generate (архетипы голосов, density, полиметрия не в каждом паттерне, ограничение 4-голосных стеков), Mutate от Keep anchor, Keep, Undo(16), locks Rhythm/Sound, random P-Locks (Lock Density / Lock Amount), применение на следующем такте при игре.
- DSP-граф 4 голосов (`spec/dsp_map.json`), poly~ на удар, мягкая защита мастера; эталонный офлайн-рендер с 22 проверками.
- Генератор и валидатор `.maxpat`; P1 hello-патч; диагностический jsui 760 × 169.
- 55 автотестов. Документация: решения, архитектура, план, приёмка A01–A26, инструкция для Live, API к проверке.
