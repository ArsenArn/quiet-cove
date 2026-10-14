# Фоновая музыка Quiet Cove

Добавлена точная копия `Sunny Harbor Afternoon.mp3` в `public/audio/sunny-harbor-afternoon.mp3` (3 261 648 bytes, длительность в браузере 134.7735 s). Исходный файл не изменялся.

Один `BackgroundMusic` управляет одним HTMLAudioElement: default ON, loop, volume=0.25, обычная скорость воспроизведения независимо от скорости игрового Engine. Заблокированный autoplay не вызывает ошибку игры: повторная попытка происходит на pointerdown/keydown, ON или возвращении фокуса/видимости. События не перехватываются и не отменяют управление лодкой. OFF сразу вызывает pause; ON продолжает тот же элемент. Pending play защищён от быстрых переключений и позднего старта после OFF/hidden.

Settings получили Music: ON/OFF (русская локализация «Музыка: ВКЛ/ВЫКЛ») в существующем стиле. Выбор хранится в `quiet_cove_music_enabled`, отдельно от профильных saves; отсутствующее значение означает ON. Ошибка localStorage не ломает текущую сессию. visibilitychange, blur/focus и pagehide/pageshow останавливают/возобновляют музыку согласно выбору игрока; уничтожение игры освобождает элемент и listeners.

MP3 URL использует `import.meta.env.BASE_URL`. Текущий Vite base='./' сохраняется; production asset доступен относительно страницы приложения, включая `/quiet-cove/` на GitHub Pages. Публикация не выполнялась.

## Изменённые файлы

- `public/audio/sunny-harbor-afternoon.mp3` — добавлен asset.
- `src/audio/BackgroundMusic.ts` — добавлен controller.
- `src/main.ts` — создание/освобождение controller и подключение UI.
- `src/ui/UI.ts`, `src/ui/locales/catalog.ts`, `src/ui/style.css` — переключатель и локализация.
- `tests/music.test.ts`, `scripts/browser-music.mjs` — unit/browser validation.

Игровые systems, balance JSON, управление, прежние settings и ключи сохранений не изменялись.

## Проверки

- `npm test`: **283/283 tests, 28/28 suites**, без unhandled errors.
- `npm run build`: PASS; прежнее предупреждение Vite о размере Phaser chunk.
- Edge headless, native autoplay policy=user-gesture-required: пойман реальный NotAllowedError, default ON остаётся, первый реальный клик запускает MP3. readyState/media duration и advancing currentTime подтверждают декодирование/воспроизведение; mediaError=null, pageerrors=[].
- После перехода в конец трека currentTime возвращается к началу без паузы: фактический loop проверен.
- OFF/ON, reload OFF/ON, быстрые повторные toggles: один audio element, настройка сохраняется. Обычный Settings language selector также проверен.
- hidden/visible и blur/focus: проверены через события в браузере и unit fixtures, включая возврат при OFF и pending play. Headless не меняет document.hidden/hasFocus при активации соседней вкладки в этой среде, поэтому физическое сворачивание окна/переключение вкладок не объявляется ручным тестом.
- Production `dist` обслужен локально под `/quiet-cove/`: правильный вложенный MP3 URL, HTTP 200, audio/mpeg, реальные playback ticks и совпадение SHA-256 с исходным MP3. Это проверка статического размещения GitHub Pages, не live deploy.

Результаты: `test-results/music/{tests.txt,build.txt,browser.json}`. Снимки Settings: `settings-music-on.png`, `settings-music-production-ru.png`.
