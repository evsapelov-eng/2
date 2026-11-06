# Сайт VERIFICATION

Статический сайт без конструктора: один файл `index.html` и папка `assets/`.
Стилистика повторяет референс twolanesmusic.com (разбор: `../site-analysis/twolanesmusic.md`),
все тексты и фото взяты с verificationgroup.ru.

## Как править

- Тексты и разметка: `src/index.html`. После правки выполните `python3 build.py`,
  он соберёт `index.html` (подставит иконки соцсетей из `src/icons/`, они из Simple Icons, CC0).
- Концерты: массив `SHOWS` в конце `src/index.html`. Прошедшие даты сами уходят в «Прошедшие».
- Фото в «Медиа»: `assets/media/NN.jpg` (1600px) и `NN-thumb.jpg` (800px), число — `PHOTOS`.
- Видео на главной: `assets/hero.mp4` (без звука), заставка `assets/poster.jpg`.

## Как посмотреть локально

    cd site && python3 -m http.server 8000

и открыть http://localhost:8000.
