# Инструкция по развертыванию Fermi Client на VPS

## Настройка конфигурации

⚠️ **ВАЖНО**: Перед началом развертывания создайте файл конфигурации:

```bash
cp deploy.config.example deploy.config
nano deploy.config
```

Заполните все параметры в файле `deploy.config`, включая:
- URL репозитория
- Ветку для развертывания
- Директории развертывания
- Имена контейнеров

**Ветка для развертывания по умолчанию**: `vps-spacebar-fermi-test`  
**Порт по умолчанию**: 8080

## Предварительные требования

1. Уже развернутый Spacebar Server (см. README_DEPLOY.md в папке server)
2. Docker и Docker Compose установлены
3. Git установлен

## Шаг 1: Подключение к серверу

```bash
# Используйте данные из вашей конфигурации
# Рекомендуется использовать SSH ключи вместо пароля
ssh <VPS_USER>@<VPS_IP>
# Или с SSH ключом:
ssh -i <путь_к_ssh_ключу> <VPS_USER>@<VPS_IP>
```

## Шаг 2: Настройка репозитория и развертывание

### Создание конфигурационного файла

Создайте файл `deploy.config` на основе примера:

```bash
cd /opt/fermi/Fermi
cp deploy.config.example deploy.config
nano deploy.config
```

Заполните все параметры в файле.

### Клонирование репозитория
```bash
mkdir -p /opt/fermi
cd /opt/fermi
# URL репозитория будет взят из deploy.config
git clone <GIT_REPO из deploy.config> Fermi
cd Fermi
git checkout <DEPLOY_BRANCH из deploy.config>
```

### Настройка прав на скрипт развертывания
```bash
chmod +x /opt/fermi/Fermi/deploy.sh
```

### Запуск развертывания
```bash
cd /opt/fermi/Fermi
./deploy.sh vps-spacebar-fermi-test
```

## Шаг 3: Настройка Nginx для Fermi Client

Если вы хотите использовать Fermi Client на отдельном поддомене (например, `client.storytable.ru`), добавьте в конфигурацию Nginx:

```bash
nano /etc/nginx/sites-available/storytable.ru
```

Добавьте следующий блок (раскомментируйте в nginx.vps.conf):

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name client.storytable.ru;

    ssl_certificate /etc/letsencrypt/live/storytable.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/storytable.ru/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket поддержка
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Или если хотите использовать основной домен для клиента, измените проксирование на порт 8080.

### Применение изменений Nginx
```bash
nginx -t
systemctl reload nginx
```

## Шаг 4: Проверка работы

1. Проверьте статус контейнера:
```bash
docker ps | grep fermi-client
```

2. Проверьте логи:
```bash
docker logs fermi-client --tail 50
```

3. Проверьте доступность:
   - Откройте `http://<VPS_IP>:8080` или настроенный домен в браузере

## Обновление развертывания

Для обновления до последней версии из ветки `vps-spacebar-fermi-test`:

```bash
cd /opt/fermi/Fermi
./deploy.sh vps-spacebar-fermi-test
```

## Полезные команды

### Просмотр логов
```bash
docker logs fermi-client -f
```

### Перезапуск клиента
```bash
docker restart fermi-client
```

### Остановка клиента
```bash
docker stop fermi-client
```

### Просмотр статуса
```bash
docker ps -a | grep fermi
```

## Устранение неполадок

### Контейнер не запускается
```bash
# Проверьте логи
docker logs fermi-client

# Проверьте, что порт 8080 свободен
netstat -tulpn | grep 8080
```

### Проблемы с подключением к серверу
Убедитесь, что:
1. Spacebar Server запущен и доступен
2. Правильно настроен URL API в клиенте (если требуется конфигурация)

## Интеграция с Spacebar Server

Fermi Client должен быть настроен на подключение к вашему Spacebar Server. Убедитесь, что:
- Server доступен по адресу `https://<VPS_DOMAIN>` (или вашему домену)
- Порт 8080 открыт в файрволе (если нужен прямой доступ)
- Nginx правильно проксирует запросы
