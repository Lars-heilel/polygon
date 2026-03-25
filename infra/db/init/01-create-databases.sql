-- Создание баз данных для каждого микросервиса
-- Этот скрипт выполняется при первом запуске PostgreSQL контейнера

CREATE DATABASE polygon_auth;
CREATE DATABASE polygon_chat;
CREATE DATABASE polygon_media;
CREATE DATABASE polygon_notification;
CREATE DATABASE polygon_user;

-- Выдача прав пользователю polygon на все базы
GRANT ALL PRIVILEGES ON DATABASE polygon_auth TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_chat TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_media TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_notification TO polygon;
GRANT ALL PRIVILEGES ON DATABASE polygon_user TO polygon;
