# 1-部署数据湖

## 1. create env file

第一步，先创建好 `.env` 文件。以便之后 `docker-compose.yml` 读取。

:::warning 

⚠️ 将以下 `.env` 文件中的值改为你自己的！并且不要泄漏。

:::

:::code-group

```env [.env]
POSTGRES_HOSTNAME=libian-datalake-postgres.yourhostname.com
POSTGRES_DB=libian-datalake
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=xxxxxxxxxx
PGADMIN_MY_EMAIL=xxxxxxxxxx@gmail.com
PGADMIN_MY_PASSWORD=xxxxxxxxxx
NC_PUBLIC_URL=https://libian-datalake-nocodb.yourhostname.com
NC_ADMIN_EMAIL=xxxxxxxxxx@gmail.com
NC_ADMIN_PASSWORD=xxxxxxxxxx
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_SSL_PY_BOOL=True
SMTP_SSL_JS_BOOL=true
SMTP_USERNAME=smtpxxxxsmtp
SMTP_PASSWORD=smtpxxxxsmtp
SMTP_SENDER=smtpxxxxsmtp@gmail.com
```

:::

然后使用以下命令读入并检查 `.env` 中的环境变量。

```shell
export $(cat .env | xargs) && echo $PGADMIN_MY_EMAIL
```

## 2. create pgadmin4 volume directory

第二步，[由于 pgadmin4 容器内的用户设计](https://www.pgadmin.org/docs/pgadmin4/latest/container_deployment.html#mapped-files-and-directories)，你得先运行以下命令来预先创建 volume 目录并设置用户组。

```shell
export $(cat .env | xargs) && \
  echo $POSTGRES_HOSTNAME && \
  echo $PGADMIN_MY_EMAIL && \
  mkdir -p ./volume/pgadmin_data && \
  mkdir -p ./volume/pgadmin_config && \
  echo "{
    \"Servers\": {
        \"1\": {
            \"Name\": \"Datalake Postgres\",
            \"Group\": \"Libian\",
            \"Username\": \"$POSTGRES_USERNAME\",
            \"Host\": \"$POSTGRES_HOSTNAME\",
            \"Port\": 5432,
            \"SSLMode\": \"verify-full\",
            \"SSLRootCert\": \"system\",
            \"MaintenanceDB\": \"$POSTGRES_DB\",
            \"PassFile\": \"~/.pgpass\"
        }
    }
}" > ./volume/pgadmin_config/servers.json && \
  echo "$POSTGRES_HOSTNAME:5432:*:$POSTGRES_USERNAME:$POSTGRES_PASSWORD" > ./volume/pgadmin_config/pgpass && \
  echo "import logging

# Switch between server and desktop mode
SERVER_MODE = True

#Change pgAdmin config DB path
CONFIG_DATABASE_URI='postgresql://$POSTGRES_USERNAME:$POSTGRES_PASSWORD@$POSTGRES_HOSTNAME:5432/$POSTGRES_DB?application_name=libian-datalake-pgadmin-config&sslmode=verify-full&sslrootcert=system'

#Setup SMTP
MAIL_SERVER = '$SMTP_SERVER'
MAIL_PORT = $SMTP_PORT
MAIL_USE_SSL = $SMTP_SSL_PY_BOOL
MAIL_USERNAME = '$SMTP_USERNAME'
MAIL_PASSWORD = '$SMTP_PASSWORD'
SECURITY_EMAIL_SENDER = '$SMTP_SENDER'

# Change log level
CONSOLE_LOG_LEVEL = logging.INFO
FILE_LOG_LEVEL = logging.INFO

" > ./volume/pgadmin_config/config_local.py && \
  chown -R 5050:5050 ./volume/pgadmin_data && \
  chown -R 5050:5050 ./volume/pgadmin_config && \
  chown -R 5050:5050 ./volume/pgadmin_config/servers.json && \
  chown -R 5050:5050 ./volume/pgadmin_config/pgpass && \
  chown -R 5050:5050 ./volume/pgadmin_config/config_local.py && \
  cat ./volume/pgadmin_config/servers.json && \
  cat ./volume/pgadmin_config/pgpass && \
  cat ./volume/pgadmin_config/config_local.py && \
  chmod 644 ./volume/pgadmin_config/servers.json && \
  chmod 644 ./volume/pgadmin_config/config_local.py && \
  chmod 600 ./volume/pgadmin_config/pgpass && \
  ls -la volume/*
```

## 3. check ssl certs

第三步，确保你的 postgres 使用的 ssl 证书和密钥权限正确:

```shell
chown 999:999 ./ca/server.crt && \
  chown 999:999 ./ca/server.key && \
  chmod 600 ./ca/server.crt && \
  chmod 600 ./ca/server.key && \
  ls -la ./ca
```

## 4. docker compose deploy

第四步，创建 `docker-compose.yml`。

:::code-group

```yml [docker-compose.yml]
name: "libian-datalake"

x-env: &env
  GENERIC_TIMEZONE: Asia/Shanghai
  TZ: Asia/Shanghai

services:
  postgres-db:
    image: postgres:17
    restart: always
    hostname: ${POSTGRES_HOSTNAME}
    env_file:
      - .env
    ports:
      - "18191:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_USER: ${POSTGRES_USERNAME}
      PGSSLMODE: verify-full
      POSTGRES_HOST_AUTH_METHOD: md5
      <<: *env
    healthcheck:
      interval: 10s
      retries: 10
      test: 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
      timeout: 2s
    volumes:
      - ./volume/db_data:/var/lib/postgresql/data
      - ./ca/server.crt:/var/lib/postgresql/server.crt:ro
      - ./ca/server.key:/var/lib/postgresql/server.key:ro
    command:
      - "-c"
      - "ssl=on"
      - "-c"
      - "ssl_cert_file=/var/lib/postgresql/server.crt"
      - "-c"
      - "ssl_key_file=/var/lib/postgresql/server.key"
  nocodb:
    image: "nocodb/nocodb:latest"
    restart: always
    ports:
      - "18193:8080"
    env_file:
      - .env
    depends_on:
      postgres-db:
        condition: service_healthy
    environment:
      NC_DB: "pg://${POSTGRES_HOSTNAME}:5432?u=${POSTGRES_USERNAME}&p=${POSTGRES_PASSWORD}&d=${POSTGRES_DB}&application_name=libian-datalake-nocodb&sslmode=verify-full"
      NC_PUBLIC_URL: ${NC_PUBLIC_URL}
      NC_ADMIN_EMAIL: ${NC_ADMIN_EMAIL}
      NC_ADMIN_PASSWORD: ${NC_ADMIN_PASSWORD}
      NC_INVITE_ONLY_SIGNUP: true
      NC_DISABLE_TELE: true
      NC_SMTP_FROM: ${SMTP_SENDER}
      NC_SMTP_HOST: ${SMTP_SERVER}
      NC_SMTP_PORT: ${SMTP_PORT}
      NC_SMTP_USERNAME: ${SMTP_USERNAME}
      NC_SMTP_PASSWORD: ${SMTP_PASSWORD}
      NC_SMTP_SECURE: ${SMTP_SSL_JS_BOOL}
      <<: *env
    volumes:
      - "./volume/nc_data:/usr/app/data"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:8080"]
      interval: 1m
      timeout: 20s
      retries: 5
      start_period: 5m
      start_interval: 30s
  pgadmin:
    env_file:
      - .env
    ports:
      - "18192:80"
    depends_on:
      postgres-db:
        condition: service_healthy
    image: dpage/pgadmin4:9.1
    restart: always
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_MY_EMAIL}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_MY_PASSWORD}
      PGADMIN_CONFIG_WTF_CSRF_ENABLED: "False"
      PGADMIN_CONFIG_WTF_CSRF_CHECK_DEFAULT: "False"
      PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION: "False"
      PGADMIN_CONFIG_MAX_LOGIN_ATTEMPTS: 15
      PGADMIN_CONFIG_CHECK_EMAIL_DELIVERABILITY: "True"
      <<: *env
    volumes:
      - "./volume/pgadmin_data:/var/lib/pgadmin"
      - "./volume/pgadmin_config/servers.json:/pgadmin4/servers.json"
      - "./volume/pgadmin_config/pgpass:/home/pgadmin/.pgpass"
      - "./volume/pgadmin_config/config_local.py:/pgadmin4/config_local.py"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:80"]
      interval: 1m
      timeout: 20s
      retries: 5
      start_period: 30m
      start_interval: 30s
```

:::

最后，试一试是否成功部署了呢:

:::code-group

```shell
docker compose up
```

```shell
docker compose up -d && docker compose logs -t -f -n 100
```

:::

:::tip pgAdmin 的安装需要长时间等待
在 cpu 非常差的服务器上，pgadmin 的安装需要等待将近 20 分钟，请保持耐心...
:::

:::tip NocoDB 的安装很快完成，但安装后需要手动配置
你可以先去手动初始化 nocodb 的一些配置，比如:

- 在 `Integrations` 中新增你的数据源连接。
- 在 `Teams & Settings` - `Setup` - `Configure E-mail` 中测试一下你的 SMTP 是否配置正确。
- 在 用户上拉框 - `Language` 中设置界面语言。
:::