-- Скрипт инициализации баз данных для микросервисов
-- Выполняется автоматически при первом запуске контейнера PostgreSQL
-- когда том с данными пуст

-- Создание баз данных для каждого микросервиса
SELECT 'CREATE DATABASE polygon_auth' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_auth')\gexec
SELECT 'CREATE DATABASE polygon_chat' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_chat')\gexec
SELECT 'CREATE DATABASE polygon_notification' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_notification')\gexec
SELECT 'CREATE DATABASE polygon_user' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_user')\gexec
SELECT 'CREATE DATABASE polygon_media' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polygon_media')\gexec

-- Выдача прав пользователю polygon на все базы
GRANT ALL PRIVILEGES ON DATABASE polygon_auth TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_chat TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_notification TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_user TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_media TO polygon;
