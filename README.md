# BugTracker

## О проекте
Полнофункциональное веб-приложение для отслеживания ошибок (Багтрекер).  
Состоит из двух независимых сервисов:
1. **Backend**  (`bugtracker-backend`) — REST API на TypeScript/Express с PostgreSQL, realtime-уведомлениями через Socket.IO и Server-Sent Events.
2. **Frontend** (`bugtracker-frontend`) — одностраничное приложение на React + Vite + Material UI.

## Основной функционал
* Регистрация пользователей, вход, восстановление пароля
* Роли и JWT-аутентификация
* Создание и управление проектами
* Управление ошибками (bugs):
  * статусы, приоритет, исполнители
  * история действий, трекинг времени
  * комментарии и упоминания
  * загрузка вложений (файлы/скриншоты)
  * просмотр «кто смотрит задачу» в реальном времени
* Приглашения пользователей в проекты по e-mail
* Настраиваемые уведомления (e-mail, realtime через WebSocket/SSE)
* Профиль пользователя

## Требования
* **Node.js** ≥ 18
* **npm** ≥ 9 (или **pnpm**/**yarn** по желанию)
* **PostgreSQL** ≥ 13 (доступ по `DATABASE_URL`)
* (Опционально) SMTP-сервер для отправки писем приглашений/восстановления пароля

## Установка и запуск
Ниже приведён быстрый старт для локальной разработки. Для продакшена настройка может отличаться (reverse-proxy, Docker и т.д.).

### 1. Клонирование репозитория
```bash
git clone https://github.com/degtev/bugtracker-public.git
cd bugtracker-public
```

### 2. Backend
```bash
cd bugtracker-backend
# Создать файл окружения
cp env.example .env
# Отредактируйте .env, указав реальное DATABASE_URL, SMTP и т.д.

# Установка зависимостей
npm install

# Запуск в режиме разработки (ts-node + nodemon)
npm run dev
# или сборка + запуск
npm run build
npm start
```
При первом запуске сервер автоматически:
* создаст необходимые таблицы (`users`, `projects`, `bugs` …)
* применит SQL-миграции из `migrations/`

API будет доступно по `http://localhost:3000` (порт можно изменить в `.env`).

### 3. Frontend
В новом терминале:
```bash
cd bugtracker-frontend
cp env.example .env      # укажите адрес back-end (например http://localhost:3000)

npm install
npm run dev              # SPA доступно на http://localhost:5173
```

### 4. Готово
Откройте `http://localhost:5173` в браузере.

## Структура репозитория
```
bugtracker-backend/   – исходники сервера (Express, TypeScript)
  ├─ src/
  │   ├─ routes/      – REST-эндпоинты
  │   ├─ models/      – SQL-запросы/таблицы
  │   └─ middleware/  – auth и прочие перехватчики
  └─ migrations/      – SQL-скрипты для БД

bugtracker-frontend/  – SPA (React, Vite, MUI)
  └─ src/
      ├─ components/  – UI-компоненты
      ├─ hooks/, utils/
      └─ contexts/    – React-контексты
```

## Скрипты npm (важные)
Backend:
* `npm run dev` – hot-reload разработка
* `npm run build` – компиляция TypeScript в `dist/`
* `npm start` – запуск собранной версии

Frontend:
* `npm run dev` – Vite dev-server
* `npm run build` – production-сборка в `dist/`
* `npm run preview` – локальный предпросмотр production-сборки
