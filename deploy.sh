#!/bin/bash

# Скрипт развертывания Fermi Client на VPS
# Использование: ./deploy.sh [branch]
#
# Перед использованием создайте файл deploy.config на основе deploy.config.example
# cp deploy.config.example deploy.config
# nano deploy.config

set -e

# Загружаем конфигурацию если она существует
if [ -f "deploy.config" ]; then
    source deploy.config
fi

# Параметры по умолчанию
BRANCH="${1:-${DEPLOY_BRANCH:-vps-spacebar-fermi-test}}"
GIT_REPO="${GIT_REPO:-https://github.com/createusernam/Fermi.git}"
REPO_DIR="/opt/fermi"
CLIENT_DIR="${DEPLOY_DIR:-$REPO_DIR/Fermi}"
BACKUP_DIR="${BACKUP_DIR:-/opt/fermi-backups}"
CONTAINER_NAME="${CONTAINER_NAME:-fermi-client}"
IMAGE_NAME="${IMAGE_NAME:-fermi-client}"

echo "🚀 Начинаем развертывание Fermi Client из ветки: $BRANCH"

# Создаем директории если их нет
mkdir -p "$REPO_DIR" "$BACKUP_DIR"

# Переходим в директорию репозитория
if [ ! -d "$CLIENT_DIR/.git" ]; then
    echo "📦 Клонируем репозиторий..."
    cd "$REPO_DIR"
    git clone "$GIT_REPO" Fermi-temp
    mv Fermi-temp/* Fermi-temp/.git "$CLIENT_DIR/" 2>/dev/null || true
    rm -rf Fermi-temp
else
    echo "📥 Обновляем репозиторий..."
    cd "$CLIENT_DIR"
    git fetch origin
fi

cd "$CLIENT_DIR"

# Переключаемся на нужную ветку
echo "🔀 Переключаемся на ветку $BRANCH..."
git checkout "$BRANCH" || git checkout -b "$BRANCH" origin/"$BRANCH"
git pull origin "$BRANCH" || true

# Останавливаем старые контейнеры
echo "🛑 Останавливаем старые контейнеры..."
docker-compose -f docker-compose.vps.yml down || true
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Собираем новый образ
echo "🔨 Собираем Docker образ..."
docker build -t "${IMAGE_NAME}:latest" .

# Запускаем контейнер
echo "▶️  Запускаем контейнер..."
docker-compose -f docker-compose.vps.yml up -d

# Ждем запуска
echo "⏳ Ждем запуска клиента..."
sleep 5

# Проверяем статус
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "✅ Развертывание завершено успешно!"
    echo "📊 Статус контейнера:"
    docker ps | grep "$CONTAINER_NAME"
else
    echo "❌ Ошибка: контейнер не запущен"
    echo "📋 Логи:"
    docker logs "$CONTAINER_NAME" --tail 50
    exit 1
fi
