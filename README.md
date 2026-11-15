# Junior Astronaut: Moon Outpost — NASA Space Apps 2026

Онлайн: https://tobish.netlify.app  (и https://edu-space.io/game)

## Что внутри
- `site/` — готовая собранная игра (статический сайт). Её можно залить на любой хостинг (Netlify: перетащить папку на app.netlify.com/drop).
  Локально: в папке `site` выполнить `npx serve -s .` и открыть http://localhost:3000
  (двойной клик по index.html не сработает — нужен веб-сервер).
- `source/` — исходный код (Vue 3 + TypeScript):
  - `pages/game.vue` — главный экран, связывает всё вместе
  - `moon/` — движок игры: ресурсы, миссии, решения, последствия (`engine.ts`, `missions.ts`, `decisions.ts`),
    реальные данные NASA (`moon/data/`: карточки, вспышки DONKI, источники), звук и голос.
    Описание модулей — `moon/CONTRACT.md`
  - `components/Moon/` — графика: сцена базы, интерфейс, интро, 4 мини-игры (`games/`)
  - `public/moon/` — картинки, видео интро, музыка, звуки, озвучка
  - `scripts/moon-*` — скрипты генерации звуков/музыки (ElevenLabs), голоса (OmniVoice), видео интро (fal)

## Собрать из исходников
Нужен Node.js 20+.
    cd source
    npm install
    npm run build      # → source/moon/web/dist
    npm run preview    # открыть http://localhost:5173
    npm run sim        # симуляция баланса игры

Ключи API в архив не входят — для скриптов генерации нужен свой `.env`
(ELEVENLABS_API_KEY, FAL_KEY).
