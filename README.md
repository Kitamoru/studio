# 🏰 PixelDungeon Run: Moraleon Edition

Высокодетализированный бесконечный раннер в стиле темного фэнтези, созданный специально для Telegram WebApp. Исследуйте опасные глубины подземелья, сражайтесь с монстрами, собирайте золото и соревнуйтесь в глобальном Зале Славы!

Игра интегрирована с [Moraleon](https://t.me/MoraleonBot) — открывается из главного экрана приложения как отдельный Telegram Mini App.

---

## 🏗️ Архитектура системы

Игра построена на базе **Next.js 15** и использует гибридную модель обработки данных:

1. **Game Engine (Client-side)**: Кастомный игровой движок на HTML5 Canvas с частотой 60 FPS. Вся физика, анимация монстров и расчет коллизий происходят на стороне клиента.
2. **State Management**: Состояние персонажа (HP, логи боя, выбранный класс) управляется через **React Context API**.
3. **Backend**: API роуты Next.js + **Prisma ORM** + **Supabase PostgreSQL** — общая база данных с Moraleon.
4. **Telegram Integration**: Аутентификация через `window.Telegram.WebApp.initData` с валидацией HMAC на сервере.

---

## 📂 Структура проекта

```text
src/
├── app/
│   ├── api/
│   │   └── game/
│   │       └── score/
│   │           └── route.ts     # GET топ-10 / POST сохранение счёта и монет
│   └── globals.css
├── components/
│   ├── ui/                      # Shadcn компоненты
│   ├── GameCanvas.tsx           # Ядро игры: рендеринг и игровой цикл
│   └── Leaderboard.tsx          # Глобальная таблица рекордов
├── context/
│   └── telegram-context.tsx     # Telegram аутентификация и контекст пользователя
├── hooks/                       # Кастомные хуки (игровой цикл, мобильные устройства)
├── lib/
│   ├── prisma.ts                # Prisma клиент
│   ├── telegramAuth.ts          # Валидация Telegram initData (HMAC)
│   ├── dnd-logic.ts             # Правила D&D: AC, броски d20, статы классов
│   ├── game-math.ts             # Коллизии AABB, прогрессия скорости
│   └── asset-manifest.ts        # Конфигурация монстров и хитбоксов
└── types/                       # TypeScript типы
prisma/
└── schema.prisma                # Схема БД (общая с Moraleon)
```

---

## 🛣️ API маршруты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `GET` | `/api/game/score?telegramId=123` | Топ-10 глобальных рекордов + личный рекорд и ранк |
| `POST` | `/api/game/score` | Сохранение результата и монет после окончания игры |

### POST /api/game/score
**Тело запроса:**
```json
{
  "initData": "query_id=...",         // для авторизации через Telegram
  "telegramId": 123456789,            // альтернативный вариант (iframe режим)
  "username": "PlayerName",
  "score": 1500,
  "coins": 42,                         // количество собранных за игру монет
  "characterClass": "FIGHTER"
}
```

**Ответ:**
```json
{ "success": true }
```

**Логика работы:**
- Монеты всегда начисляются на баланс пользователя в таблице `users`.
- В таблице `game_scores` хранится **только лучший результат** игрока. Если новый результат лучше предыдущего, запись обновляется; если нет — только добавляются монеты.
- Все операции выполняются в транзакции для обеспечения целостности данных.

---

## 🪙 Система монет

- Монеты периодически появляются на экране пачками по 3 штуки.
- При столкновении с игроком монета исчезает и засчитывается.
- Счётчик собранных монет отображается в верхней панели рядом с пройденными метрами.
- В конце игры количество монет отправляется на сервер и прибавляется к общему балансу пользователя в Moraleon.
- Монеты можно тратить в основном приложении Moraleon (покупка предметов, улучшений и т.д.).

---

## 🛡️ Игровые механики D&D

- **Класс Брони (AC)**: При столкновении бросается d20. Если результат + бонусы выше AC монстра — удар заблокирован.
- **Уникальные классы**:
  - **Fighter**: Танк с высоким AC (15) и запасом здоровья
  - **Rogue**: Мастер маневров с пассивным двойным прыжком
  - **Wizard**: Бонус +25% к опыту (дистанции)
  - **Bard**: Пассивная регенерация здоровья со временем

---

## 👾 Бестиарий

- **Древний Дракон**: Огромный противник с анимированными крыльями и извергающимся пламенем
- **Мимик**: Жуткий сундук, который клацает зубами и следит за вами множеством глаз
- **Огр**: Массивный враг с шипованной дубиной
- **Бехолдер, Слизь, Призраки, Летучие мыши**: У каждого свой паттерн движения и уникальные хитбоксы

---

## 🔗 Интеграция с Moraleon

Игра и Moraleon используют **общую базу данных Supabase**. Пользователи должны быть зарегистрированы в Moraleon — игра ищет `user_id` по `telegram_id` перед сохранением счёта.

Открытие из Moraleon происходит через:
```ts
tg.openTelegramLink('https://t.me/MoraleonBot/dungeonrun');
```

---

## 🚀 Технологический стек

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Shadcn UI, Radix UI
- **Database**: Supabase PostgreSQL 
- **ORM**: Prisma 5.22
- **Auth**: Telegram WebApp initData (HMAC валидация)
- **Deploy**: Vercel

---

## ⚙️ Быстрый старт

1. **Клонирование**
```bash
git clone https://github.com/yourusername/dnd-runner.git
cd dnd-runner
```

2. **Установка зависимостей**
```bash
npm install
```

3. **Переменные окружения**
```env
DATABASE_URL=your_supabase_postgresql_connection_string
TELEGRAM_TOKEN=your_telegram_bot_token
```

4. **Генерация Prisma клиента**
```bash
npx prisma generate
```

5. **Запуск**
```bash
npm run dev
```

---

## 📊 Схема БД (таблицы игры)

```prisma
model users {
  id                Int                @id @default(autoincrement())
  telegram_id       BigInt             @unique
  username          String?
  character_class   String?
  coins             Int                @default(0) // Накопительный баланс золота
  octalysis_factors octalysis_factors?
  game_scores       game_scores[]
}

model game_scores {
  id              Int      @id @default(autoincrement())
  user_id         Int
  telegram_id     BigInt
  username        String
  score           Float
  coins           Int      @default(0) // Золото, добытое за конкретную игру
  character_class String?
  created_at      DateTime @default(now())

  user users @relation(fields: [user_id], references: [id])

  @@index([score(sort: Desc)])
  @@index([telegram_id])
}
```

---

## 🔧 Переменные окружения Vercel

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | Строка подключения Supabase PostgreSQL |
| `TELEGRAM_TOKEN` | Токен бота для валидации initData |

---

*Приключение ждет в твоем Telegram! Открой через [@MoraleonBot](https://t.me/MoraleonBot)*
