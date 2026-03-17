# Sonus — Дизайн-документ

## 1. Обзор проекта

**Sonus** (лат. "звук") — персональное приложение для стриминга локальной музыкальной коллекции. Предназначено для пользователей, чья музыка отсутствует на стриминговых площадках.

- **Масштаб**: 5-10 одновременных пользователей
- **Деплой**: VPS/облако
- **Клиенты**: веб (React), iOS (Swift), терминал (Go TUI)

---

## 2. Технологический стэк

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| Бэкенд | Go 1.22+, chi router | Нативная работа с IO, один бинарник, горутины для параллельного сканирования и транскодинга |
| База данных | SQLite (modernc.org/sqlite) | Нулевые операционные затраты, WAL mode для конкурентного чтения, pure Go без CGO |
| Аутентификация | bcrypt + JWT (golang-jwt/jwt) | Стандартный подход, access + refresh токены |
| Метаданные | dhowden/tag + ffprobe | dhowden/tag для ID3/MP4/FLAC/OGG тегов, ffprobe как fallback и для длительности |
| Транскодинг | ffmpeg | Универсальный, поддерживает все форматы, on-the-fly транскодинг в stdout |
| Фронтенд | React 19, Vite, TypeScript, Tailwind CSS, Zustand | Быстрый билд, минимальный бойлерплейт, TypeScript strict mode |
| iOS | Swift 5.9+, SwiftUI, AVFoundation | Нативный iOS-опыт, background audio, lock screen controls |
| Терминал | bubbletea, bubbles, lipgloss | Зрелая TUI-экосистема на Go, общий модуль с бэкендом |
| Логирование | log/slog (стандартная библиотека) | Структурированное логирование, нет внешних зависимостей |

---

## 3. Структура монорепозитория

```
sonus/
├── go.mod                              # Go module (server + tui)
├── go.sum
├── Makefile
├── Dockerfile
├── .gitignore
├── CLAUDE.md
│
├── cmd/
│   ├── server/
│   │   └── main.go                     # Точка входа бэкенда
│   └── tui/
│       └── main.go                     # Точка входа TUI-клиента
│
├── internal/
│   ├── api/
│   │   ├── router.go                   # chi router, middleware chain
│   │   ├── middleware/
│   │   │   ├── auth.go                 # JWT валидация
│   │   │   ├── cors.go
│   │   │   └── logging.go
│   │   └── handler/
│   │       ├── auth.go                 # Login, register, refresh
│   │       ├── library.go              # Artists, albums, tracks
│   │       ├── stream.go               # Аудио-стриминг
│   │       ├── playlist.go             # CRUD плейлистов
│   │       ├── favorites.go            # Избранное
│   │       ├── history.go              # История прослушиваний
│   │       ├── search.go               # Полнотекстовый поиск
│   │       └── coverart.go             # Обложки альбомов
│   │
│   ├── service/                        # Бизнес-логика
│   │   ├── auth.go
│   │   ├── library.go
│   │   ├── scanner.go                  # Сканер директорий
│   │   ├── transcoder.go               # ffmpeg pipeline
│   │   ├── stream.go
│   │   ├── playlist.go
│   │   ├── search.go
│   │   └── coverart.go
│   │
│   ├── model/                          # Доменные типы
│   │   ├── user.go
│   │   ├── track.go
│   │   ├── album.go
│   │   ├── artist.go
│   │   ├── playlist.go
│   │   └── history.go
│   │
│   ├── store/                          # Слой доступа к данным
│   │   ├── store.go                    # Интерфейсы репозиториев
│   │   └── sqlite/
│   │       ├── sqlite.go               # Подключение, WAL mode
│   │       ├── migrations/             # SQL-миграции (go:embed)
│   │       │   ├── 001_init.sql
│   │       │   └── ...
│   │       ├── user.go
│   │       ├── track.go
│   │       ├── album.go
│   │       ├── artist.go
│   │       ├── playlist.go
│   │       └── history.go
│   │
│   ├── config/
│   │   └── config.go                   # TOML + env vars + flags
│   │
│   └── auth/
│       └── jwt.go                      # Создание/валидация JWT
│
├── pkg/
│   └── client/                         # Go API-клиент (для TUI и тестов)
│       ├── client.go
│       ├── auth.go
│       ├── library.go
│       ├── stream.go
│       └── playlist.go
│
├── web/                                # React-фронтенд
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                        # Fetch-обёртки
│       ├── components/
│       │   ├── Player/                 # Плеер (persistent)
│       │   ├── Library/                # Просмотр библиотеки
│       │   ├── Search/
│       │   ├── Queue/
│       │   ├── Playlist/
│       │   ├── Auth/
│       │   └── Layout/                 # Sidebar, навигация
│       ├── hooks/                      # usePlayer, useAuth, useLibrary
│       ├── store/                      # Zustand stores
│       │   ├── playerStore.ts
│       │   ├── authStore.ts
│       │   └── libraryStore.ts
│       ├── pages/                      # Роуты
│       └── types/                      # TypeScript-типы
│
├── ios/                                # Xcode-проект
│   └── MusicStream/
│       ├── App/
│       │   ├── SonusApp.swift
│       │   └── ContentView.swift
│       ├── Models/
│       ├── Services/
│       │   ├── APIClient.swift
│       │   ├── AudioPlayerService.swift
│       │   ├── AuthService.swift
│       │   └── NowPlayingService.swift
│       ├── Views/
│       │   ├── PlayerView.swift
│       │   ├── LibraryView.swift
│       │   ├── SearchView.swift
│       │   └── PlaylistView.swift
│       └── Resources/
│
├── docs/
│   └── design.md                       # Этот документ
│
└── scripts/
    └── dev.sh                          # Запуск всех сервисов для разработки
```

---

## 4. REST API

Все эндпоинты имеют префикс `/api/v1`. Версионирование через URL path.

### 4.1 Аутентификация

```
POST   /api/v1/auth/register            # Регистрация
POST   /api/v1/auth/login               # Логин → { accessToken, refreshToken }
POST   /api/v1/auth/refresh             # Обновление access token
```

### 4.2 Библиотека (read-only, заполняется сканером)

```
GET    /api/v1/artists                   # Список артистов (пагинация)
GET    /api/v1/artists/:id               # Артист + его альбомы
GET    /api/v1/albums                    # Список альбомов (пагинация, фильтры)
GET    /api/v1/albums/:id                # Альбом + треки
GET    /api/v1/tracks                    # Список треков (пагинация, фильтры)
GET    /api/v1/tracks/:id                # Метаданные трека
```

### 4.3 Стриминг

```
GET    /api/v1/stream/:trackID           # Аудиопоток (поддержка Range headers)
                                         # Query params: ?format=mp3&bitrate=192&token=<jwt>
```

### 4.4 Обложки

```
GET    /api/v1/coverart/:albumID         # Обложка альбома
                                         # Query params: ?token=<jwt>
```

### 4.5 Поиск

```
GET    /api/v1/search?q=term&type=all    # Полнотекстовый поиск (FTS5)
                                         # type: artist | album | track | all
```

### 4.6 Плейлисты (per-user)

```
GET    /api/v1/playlists                 # Плейлисты пользователя
POST   /api/v1/playlists                 # Создать плейлист
GET    /api/v1/playlists/:id             # Плейлист + треки
PUT    /api/v1/playlists/:id             # Обновить (имя, порядок)
DELETE /api/v1/playlists/:id             # Удалить
POST   /api/v1/playlists/:id/tracks      # Добавить трек(и)
DELETE /api/v1/playlists/:id/tracks/:trackID  # Убрать трек
```

### 4.7 Избранное (per-user)

```
GET    /api/v1/favorites                 # Список избранного
POST   /api/v1/favorites                 # Добавить { type, id }
DELETE /api/v1/favorites/:type/:id       # Удалить
```

### 4.8 История прослушиваний (per-user)

```
GET    /api/v1/history                   # Пагинированная история
POST   /api/v1/history                   # Записать прослушивание { trackID, duration }
```

### 4.9 Администрирование

```
POST   /api/v1/admin/scan                # Запустить сканирование библиотеки
GET    /api/v1/admin/scan/status          # Прогресс сканирования
```

---

## 5. Схема базы данных

SQLite с WAL mode. Миграции хранятся как SQL-файлы и встраиваются в бинарник через `go:embed`.

### 5.1 Библиотека (заполняется сканером)

```sql
CREATE TABLE artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE albums (
    id TEXT PRIMARY KEY,
    artist_id TEXT REFERENCES artists(id),
    name TEXT NOT NULL,
    year INTEGER,
    genre TEXT,
    cover_art_path TEXT,
    track_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tracks (
    id TEXT PRIMARY KEY,
    album_id TEXT REFERENCES albums(id),
    artist_id TEXT REFERENCES artists(id),
    title TEXT NOT NULL,
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    duration_seconds INTEGER NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    format TEXT,                     -- flac, mp3, ogg, wav, etc.
    bitrate INTEGER,
    sample_rate INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Полнотекстовый поиск (FTS5)
CREATE VIRTUAL TABLE tracks_fts USING fts5(
    title, artist_name, album_name,
    content=tracks,
    content_rowid=rowid
);
```

### 5.2 Пользователи и персональные данные

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlist_tracks (
    playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
    track_id TEXT REFERENCES tracks(id),
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE favorites (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,         -- 'track', 'album', 'artist'
    item_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_type, item_id)
);

CREATE TABLE listening_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT REFERENCES tracks(id),
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER
);
```

### 5.3 Индексы

```sql
CREATE INDEX idx_tracks_album ON tracks(album_id);
CREATE INDEX idx_tracks_artist ON tracks(artist_id);
CREATE INDEX idx_albums_artist ON albums(artist_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_history_user_date ON listening_history(user_id, played_at DESC);
CREATE INDEX idx_tracks_file_path ON tracks(file_path);
CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
```

---

## 6. Сканер библиотеки

Сканер отвечает за обнаружение музыкальных файлов, извлечение метаданных и заполнение базы данных.

### 6.1 Поддерживаемые форматы

`.flac`, `.mp3`, `.ogg`, `.wav`, `.aac`, `.m4a`, `.alac`, `.wma`, `.ape`, `.opus`

### 6.2 Алгоритм сканирования

1. **Walk**: `filepath.WalkDir` по настроенным директориям, сбор путей файлов с известными расширениями
2. **Diff**: Сравнение с `tracks.file_path` в БД — выявление новых, удалённых и изменённых файлов (по mtime)
3. **Extract**: Worker pool (4-8 горутин) извлекает метаданные:
   - `dhowden/tag` для ID3, MP4, FLAC, OGG тегов
   - `ffprobe` как fallback для неподдерживаемых форматов (WMA, APE)
   - `ffprobe` для длительности всех файлов (dhowden/tag не предоставляет duration)
4. **Upsert**: Вставка/обновление artists, albums, tracks. Матчинг артистов и альбомов по нормализованным именам (case-insensitive, trimmed). Альбом матчится по паре (artist_name, album_name)
5. **Cleanup**: Удаление треков, файлы которых больше не существуют. Удаление пустых альбомов, затем пустых артистов
6. **FTS rebuild**: `INSERT INTO tracks_fts(tracks_fts) VALUES('rebuild')`

### 6.3 Извлечение обложек

При сканировании для каждого альбома:
1. Извлечь embedded art из первого трека альбома через `dhowden/tag` → `m.Picture()`
2. Сохранить как `<data_dir>/coverart/<albumID>.jpg`
3. Fallback: поиск `cover.jpg`, `cover.png`, `folder.jpg`, `front.jpg` в директории альбома
4. Путь записывается в `albums.cover_art_path`

### 6.4 Периодическое сканирование

Внутренний планировщик на `time.Ticker` (конфигурируемый интервал, по умолчанию 1 час). Также доступен ручной запуск через `POST /api/v1/admin/scan`.

---

## 7. Транскодинг

### 7.1 Стратегия: on-the-fly + дисковый кэш

Транскодинг выполняется при первом запросе трека в не-оригинальном формате. Результат кэшируется на диске для последующих запросов.

### 7.2 Поток обработки запроса

```
GET /api/v1/stream/:trackID?format=mp3&bitrate=192

1. Оригинальный формат совпадает с запрошенным? → Отдать файл напрямую
2. Проверить кэш: <data_dir>/cache/transcoded/<trackID>/mp3_192 → Отдать из кэша
3. Иначе: запустить ffmpeg, tee output в HTTP response и кэш-файл одновременно
```

### 7.3 ffmpeg-команды

```bash
# MP3
ffmpeg -i <input> -map 0:a:0 -c:a libmp3lame -b:a 192k -f mp3 -

# AAC
ffmpeg -i <input> -map 0:a:0 -c:a aac -b:a 192k -f adts -

# OGG Vorbis
ffmpeg -i <input> -map 0:a:0 -c:a libvorbis -b:a 192k -f ogg -
```

### 7.4 Поддержка Range requests

- **Оригинальные файлы и кэшированные транскоды**: `http.ServeContent()` — полная поддержка Range, seeking
- **Live-транскоды (первый запрос)**: `Transfer-Encoding: chunked`, seeking ограничен до окончания транскодинга. После завершения и кэширования — полная поддержка

### 7.5 Кэш

- Путь: `<data_dir>/cache/transcoded/<trackID>/<format>_<bitrate>`
- Максимальный размер: конфигурируемый (по умолчанию 10 GB)
- Eviction: LRU — фоновая горутина удаляет наименее используемые файлы при превышении лимита
- Незавершённые транскоды (отключение клиента) — временный файл удаляется

### 7.6 Опциональность ffmpeg

При запуске сервер проверяет наличие ffmpeg в PATH. Если ffmpeg отсутствует — логируется предупреждение, запросы на транскодинг возвращают `501 Not Implemented`, но стриминг оригинальных файлов работает.

---

## 8. Аутентификация

### 8.1 Схема

- **Хэширование**: bcrypt, cost 12
- **Access token**: JWT (HS256), TTL 15 минут. Payload: `{ sub: userID, username, isAdmin, exp, iat }`
- **Refresh token**: Opaque random string, хранится в таблице `refresh_tokens`, TTL 30 дней. Серверная ревокация

### 8.2 Поток

1. **Логин**: `POST /auth/login { username, password }` → проверка bcrypt → выдача access + refresh
2. **Обновление**: `POST /auth/refresh { refreshToken }` → проверка в БД → новый access token
3. **Middleware**: `Authorization: Bearer <token>` → валидация JWT → userID в context
4. **Stream/coverart**: также принимают `?token=<jwt>` query param (HTML5 `<audio src>` и `<img src>` не могут задать Authorization header)

---

## 9. Архитектура фронтенда (React)

### 9.1 Стэк

- **Сборка**: Vite + TypeScript strict mode
- **UI**: React 19 + Tailwind CSS
- **Состояние**: Zustand (минимальный бойлерплейт)
- **Роутинг**: React Router v7
- **HTTP**: fetch с типизированными обёртками

### 9.2 Аудиоплеер

Ядро фронтенда — persistent player bar. Один элемент `<audio>` монтируется в `<PlayerProvider>` на уровне App и никогда не размонтируется.

```typescript
// Zustand store — источник правды для UI
interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';
  // actions
  play(track: Track): void;
  pause(): void;
  next(): void;
  previous(): void;
  seek(seconds: number): void;
  // ...
}
```

Двунаправленная синхронизация:
- Zustand actions → `audioRef.current` методы (play, pause, seek, volume)
- Audio events (`timeupdate`, `ended`, `loadedmetadata`) → обновление store

### 9.3 Layout

```
+--------------------------------------------------+
|  [Sidebar]          |    [Main Content]           |
|  - Library          |    (зависит от роута)       |
|    - Артисты        |                             |
|    - Альбомы        |                             |
|    - Треки          |                             |
|  - Плейлисты        |                             |
|  - Избранное        |                             |
|  - История          |                             |
|  - Поиск            |                             |
+--------------------------------------------------+
|  [Player Bar — всегда видим]                      |
|  [<<] [Play/Pause] [>>] | Track - Artist          |
|  [Progress =====>---------] 2:31 / 4:15           |
|  [Volume] [Shuffle] [Repeat] [Queue]              |
+--------------------------------------------------+
```

### 9.4 Роуты

| Путь | Описание |
|------|----------|
| `/` | Главная — недавно проигранное, недавно добавленное |
| `/artists` | Сетка/список артистов |
| `/artists/:id` | Артист + альбомы |
| `/albums` | Сетка альбомов |
| `/albums/:id` | Альбом + список треков |
| `/tracks` | Все треки (таблица, сортировка) |
| `/playlists` | Плейлисты пользователя |
| `/playlists/:id` | Плейлист + треки |
| `/favorites` | Избранное |
| `/history` | История прослушиваний |
| `/search?q=` | Результаты поиска |
| `/login` | Авторизация |

### 9.5 Сборка и деплой

React-приложение собирается в `web/dist/` и отдаётся Go-бэкендом через `http.FileServer`. В продакшене — встраивание в Go binary через `//go:embed web/dist`. SPA fallback: все не-API и не-файловые роуты возвращают `index.html`.

---

## 10. Архитектура iOS-приложения (Swift)

### 10.1 Стэк

- **UI**: SwiftUI
- **Архитектура**: MVVM + `@Observable` (Swift 5.9+ Observation framework)
- **Аудио**: `AVPlayer` (поддержка HTTP-стриминга, progressive download, seeking)
- **Сеть**: URLSession + async/await

### 10.2 Аудио-воспроизведение

`AVPlayer` нативно поддерживает HTTP Range requests и seeking. Стриминг-URL:
```
{baseURL}/api/v1/stream/{trackID}?token={jwt}
```

### 10.3 Background audio

1. `Info.plist`: `UIBackgroundModes` → `audio`
2. `AVAudioSession.sharedInstance().setCategory(.playback)` при запуске
3. `MPRemoteCommandCenter`: play, pause, next, previous, seek
4. `MPNowPlayingInfoCenter`: метаданные трека + обложка

Это даёт lock screen controls, Control Center и поддержку CarPlay.

### 10.4 Структура

```
ios/MusicStream/
├── App/
│   ├── SonusApp.swift
│   └── AppState.swift
├── Services/
│   ├── APIClient.swift              # URLSession, async/await
│   ├── AuthService.swift            # Keychain для токенов
│   ├── AudioPlayerService.swift     # AVPlayer wrapper, @Observable
│   └── NowPlayingService.swift      # MPRemoteCommandCenter
├── Models/
│   ├── Track.swift
│   ├── Album.swift
│   ├── Artist.swift
│   └── Playlist.swift
├── Views/
│   ├── ContentView.swift            # Tab-based root
│   ├── Library/
│   ├── Player/
│   │   ├── MiniPlayerView.swift     # Нижняя панель
│   │   └── FullPlayerView.swift     # Развёрнутый вид (sheet)
│   ├── Search/
│   ├── Playlist/
│   └── Auth/
└── Utilities/
    ├── KeychainHelper.swift
    └── ImageCache.swift
```

### 10.5 Оффлайн-кэширование (будущая фаза)

Не в первой версии, но архитектура не препятствует:
- Скачивание треков в documents directory
- Локальная SQLite БД для маппинга trackID → local path
- Кнопка "Download" на альбомах/плейлистах

---

## 11. Терминальный клиент (Go TUI)

### 11.1 Стэк

bubbletea + bubbles + lipgloss. Использует `pkg/client/` — тот же типизированный API-клиент, что и тесты бэкенда.

### 11.2 Воспроизведение

TUI не воспроизводит аудио напрямую. Он открывает HTTP-поток и передаёт его в subprocess `mpv` или `ffplay`:
```bash
mpv --no-video --really-quiet <stream_url>
```
`mpv` поддерживает seeking через IPC, которым TUI может управлять.

### 11.3 Layout

```
┌─ Sonus ─────────────────────────────────────────┐
│ [Library] [Search] [Playlists] [Queue]          │
├─────────────────────────────────────────────────┤
│ Albums by Artist Name                           │
│                                                 │
│   > Album One (2020)                            │
│     Album Two (2018)                            │
│                                                 │
│ Tracks:                                         │
│   1. Track One ...................... 3:42       │
│   2. Track Two ...................... 4:15       │
│                                                 │
├─────────────────────────────────────────────────┤
│ > Track One - Artist Name    [2:31 / 3:42]      │
│ ████████████████░░░░░░░░░░   Vol: ████░░        │
│ [p]lay [n]ext [b]ack [s]earch [q]uit            │
└─────────────────────────────────────────────────┘
```

---

## 12. Конфигурация

Единый конфиг с приоритетами: defaults → TOML файл → env vars → CLI flags.

```toml
[server]
address = ":8080"
data_dir = "/var/lib/sonus"

[library]
music_dirs = ["/mnt/music", "/home/user/Music"]
scan_on_startup = true
scan_interval = "1h"

[transcoding]
ffmpeg_path = "ffmpeg"              # авто-поиск в PATH
cache_max_size = "10GB"
default_format = "original"         # или "mp3", "aac", "ogg"
default_bitrate = 192

[auth]
jwt_secret = ""                     # авто-генерация при первом запуске
access_token_ttl = "15m"
refresh_token_ttl = "720h"
registration_enabled = true         # можно отключить после создания пользователей
```

Env vars с префиксом `SONUS_`: `SONUS_SERVER_ADDRESS`, `SONUS_LIBRARY_MUSIC_DIRS`, и т.д.

---

## 13. Go-зависимости

```
# Router
github.com/go-chi/chi/v5

# Database
modernc.org/sqlite

# Auth
golang.org/x/crypto              # bcrypt
github.com/golang-jwt/jwt/v5

# Metadata
github.com/dhowden/tag

# TUI
github.com/charmbracelet/bubbletea
github.com/charmbracelet/bubbles
github.com/charmbracelet/lipgloss

# Config
github.com/knadh/koanf/v2

# UUID
github.com/google/uuid
```

---

## 14. Фазы разработки

### Phase 1: Core backend
1. Scaffolding: go.mod, cmd/server/main.go, конфигурация
2. SQLite: подключение, миграции, начальная схема
3. Auth: user model, bcrypt, JWT, эндпоинты login/register/refresh
4. Сканер: walk, metadata extraction, upsert
5. Library API: artists/albums/tracks с пагинацией
6. Стриминг: отдача оригинальных файлов через `http.ServeContent`
7. Обложки: извлечение и отдача

### Phase 2: Web frontend
1. Vite + React + TypeScript + Tailwind scaffolding
2. Auth (login, register)
3. Просмотр библиотеки (artists → albums → tracks)
4. Аудиоплеер (HTML5 Audio, Zustand, player bar)
5. Поиск
6. Плейлисты, избранное, история

### Phase 3: Транскодинг
1. ffmpeg-интеграция
2. Дисковый кэш
3. Расширение stream endpoint (format/bitrate query params)
4. Cache eviction

### Phase 4: iOS
1. SwiftUI проект, API client
2. Auth, Keychain
3. Library browsing
4. AVPlayer + background audio + Now Playing
5. Поиск, плейлисты, избранное

### Phase 5: Terminal client
1. bubbletea scaffolding, pkg/client
2. Library browsing
3. Поиск
4. mpv-based playback

### Phase 6: Polish
1. Embed web frontend в Go binary
2. Dockerfile
3. systemd unit
4. Периодическое сканирование (time.Ticker)
