# API Max, которые писались по памяти — проверить в Max до P1/P2

Документация Cycling '74 (docs.cycling74.com) была недоступна из среды разработки (сеть). Всё ниже написано по памяти Max 8/9 и **должно быть сверено** в Max (Help/Reference) на вашей машине. Если что-то отличается — правится в одном месте: `tools/build_patches.py` (патчи) или `js/max_adapter.js` / `js/ui/noiz_ui.js`.

| # | Что | Предположение | Как проверить | Где править |
|---|---|---|---|---|
| 1 | `transport` — порядок выходов | 0 bars, 1 beats, 2 units (ticks в доле), 3 resolution (480), 4 tempo | открыть help `transport`; в NØIZ при игре строка `SYNC LIVE` и BPM в UI должны совпасть с Live | `build_main()` — соединения `tr → pk` |
| 2 | `transport` внутри M4L следует транспорту Live | да, по bang отдаёт текущую позицию Live | играть/останавливать Live, смотреть `SYNC` | — |
| 3 | `svf~` выходы | 0 lowpass, 1 highpass, 2 bandpass, 3 notch; аргументы `freq res`, res 0..1 | help `svf~`; на слух: HISS (hp) светлый, ATMOS (lp) тёмный | `voice_chain()` `out_idx` |
| 4 | `pipe` с N значениями | `pipe 0 0. … 0` = 6 значений + задержка последним аргументом → 7 входов (последний = delay), 6 выходов; `clear` отменяет ожидающие | help `pipe` | `build_main()` |
| 5 | `poly~ … @steal 1`, сообщение `note` | `note` идёт в первый свободный экземпляр; `steal` забирает занятый при переполнении | help `poly~` | `build_main()` |
| 6 | `thispoly~` с сигналом на входе | экземпляр «занят», пока сигнал ≠ 0 | help `thispoly~` | `build_voice()` |
| 7 | `pattr @bindto engine` к `[js]` | js с `getvalueof/setvalueof`, varname `engine` | Max Console: нет ошибок `pattr: can't bind` | `build_main()` |
| 8 | Live Blob-параметр | `parameter_type 3` = Blob, `parameter_invisible 1` = Stored Only | Inspector у `pattr`: Type = Blob, Visibility = Stored Only; A20 | `build_main()` |
| 9 | `[js]` `Global`, `Task`, `notifyclients`, `arrayfromargs` | доступны в legacy JS engine | Max Console без ошибок JS | `js/max_adapter.js` |
| 10 | `jsui` mgraphics API | `mgraphics.init/size/scale/ellipse/rectangle/show_text/text_measure/set_font_weight`, `onclick/ondrag/ondblclick`, `ondrag` с `but=0` на отпускании | открыть device, кликать | `js/ui/noiz_ui.js` |
| 11 | `live.thisdevice` выход 0 | bang, когда устройство загружено | UI показывает состояние, а не «waiting for engine» | `build_main()` |
| 12 | `live.path` / `live.observer` | `path live_set` → id из выхода 0 в правый вход observer; `property loop` / `loop_start` / `loop_length` (в долях) | включить loop в Live; A19 | `build_main()` |
| 13 | `expr` со `\,` | запятая в аргументах `pow()` экранируется `\,` | открыть voice-патч: нет красных объектов | `build_voice()` |
| 14 | `pink~`, `tanh~`, `abs~`, `>~`, `sqrt` | существуют в стандартном Max | нет красных объектов | — |
| 15 | В Max 9 `js` — legacy-движок или V8 | код написан на чистом ES5 → работает в обоих | Max Console | — |
