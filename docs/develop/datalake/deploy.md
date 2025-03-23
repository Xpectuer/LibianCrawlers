# 1-部署数据湖

本文描述了如何部署 LibianDatalake 数据湖。

## 1. 创建环境变量文件

第一步，先创建好 `.env` 文件。它之后会被 shell 命令与 `docker-compose.yml` 读取。

:::warning

⚠️ 将以下 `.env` 文件中的值改为你自己的！并且不要泄漏。

:::

:::code-group
<<< @/develop/datalake/.env-template [.env]
:::

然后使用以下命令读入并检查 `.env` 中的环境变量。

```shell
export $(cat .env | xargs) && echo $PGADMIN_MY_EMAIL
```

## 2. 检查 SSL 证书和私钥

:::tip 使用 TLS 的必要性

启用 TLS 加密传输，可以保护各个模块与 PostgreSQL 数据库之间的通信安全。

- ⚠️ 否则，你的 PostgreSQL 的通信报文将在公网裸奔。

由于 MinIO Server 在 Docker Compose 的 内部网络 和 公网网络 中的协议（`https`）应当一致，因此此处需要在 MinIO 服务启动时提供 SSL 证书。

- ⚠️ 如果在内网使用 http 而在公网使用 https，nocodb 将不能区分内网和公网，将会在数据表中保留 `http://` 开头的 MinIO 链接，这会导致图片和附件的链接无效。

:::

第一步，请先申请自己的 SSL证书，推荐使用通配符域名证书，以覆盖多个子域。例如，`*.yourdomain.com` 可以同时保护 `libian-datalake-miniosnsd.yourdomain.com` 和 `libian-datalake-postgres.yourdomain.com` 等多个服务。

第二步，将申请到的 fullchain.crt 和 private.key 文件复制到指定目录

```shell
# 创建 ca 目录（如果不存在）
mkdir -p ./ca

# 复制证书文件
cp /path/to/your/fullchain.crt ./ca/server.crt
cp /path/to/your/private.key ./ca/server.key
```

第三步，确保 SSL 证书和密钥的权限配置正确，防止未经授权的访问：

按照以下步骤确保证书和密钥的权限配置正确

> 这个示例中的 `./ca/server.*` 是通配符证书，如果你的证书不是通配符证书，则自行修改。

```shell
chown 999:999 ./ca/server.crt && \
  chown 999:999 ./ca/server.key && \
  chmod 600 ./ca/server.crt && \
  chmod 600 ./ca/server.key && \
  openssl pkcs8 -topk8 -in ./ca/server.key -out ./ca/minio-private.key -nocrypt && \
  cp ./ca/server.crt ./ca/minio-public.crt && \
  chown 0:0 ./ca/minio-private.key && \
  chown 0:0 ./ca/minio-public.crt && \
  chmod 600 ./ca/minio-private.key && \
  chmod 600 ./ca/minio-public.crt && \
  ls -la ./ca
```


:::info 踩坑

MinIO 报错 `The private key contains additional data`，可参考以下文档。

* [The private key contains additional data](https://github.com/minio/minio/issues/8106)
  * [Letsencrypt ecc key doesn't work with MinIO](https://github.com/minio/minio/issues/7698)
  * [ECC certificate "private key contains additional data"](https://github.com/acmesh-official/acme.sh/issues/2295)
  * https://stackoverflow.com/questions/53940545/is-there-any-way-we-can-convert-rsa-private-key-to-x509-format
:::

## 3. 创建 MinIO 配置文件

MinIO 的单节点单磁盘（SNSD, Single Node Single Drive）部署模式需要通过配置文件来指定运行环境参数。为此，我们需要创建并导入必要的环境变量。

根据 [MinIO 官方文档](https://min.io/docs/minio/container/operations/install-deploy-manage/deploy-minio-single-node-single-drive.html#create-the-environment-variable-file)，请按照以下步骤操作:

```shell
export $(cat .env | xargs) && \
  echo "
# MINIO_ROOT_USER and MINIO_ROOT_PASSWORD sets the root account for the MinIO server.
# This user has unrestricted permissions to perform S3 and administrative API operations on any resource in the deployment.
# Omit to use the default values 'minioadmin:minioadmin'.
# MinIO recommends setting non-default values as a best practice, regardless of environment

MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD

# MINIO_VOLUMES sets the storage volume or path to use for the MinIO server.

MINIO_VOLUMES=\"/mnt/data\"
" > ./minio.config.env && \
  cat ./minio.config.env && \
  chmod 600 ./minio.config.env && \
  ls -la
```

## 4. 创建 pgadmin4 数据目录并设置用户权限

为了确保pgAdmin4容器能够正确运行并管理数据库，需要在启动容器之前，预先创建必要的存储卷目录，并设置正确的用户和权限。

:::tip 为什么需要预先创建存储卷

pgAdmin4容器通常以非root用户身份运行（例如UID:5050），因此宿主机上的存储卷目录必须与容器内部的用户环境保持一致，以确保容器内的进程能够正确访问和修改这些目录下的文件。如果不预先设置正确的用户组和权限，可能会导致容器无法写入数据或出现其他权限相关的问题。

可参考 [pgAdmin 官方文档](https://www.pgadmin.org/docs/pgadmin4/latest/container_deployment.html#mapped-files-and-directories) 了解更多。

:::

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

## 5. Docker Compose 部署

### 5.1 创建 docker-compose.yml 文件

第四步，创建 `docker-compose.yml`。

:::tip 你可以根据需要来决定是否启动 MinIO SNSD
如果你已经拥有自己的 MinIO 或 S3 存储，则可以使用自己的 MinIO 存储，并修改此文件内容。
:::

:::code-group

```shell
echo '
<!--@include: ./docker-compose.yml-->
' > docker-compose.yml
```

<<< @/develop/datalake/docker-compose.yml

:::

### 5.2 运行

运行此命令以部署:

:::code-group
```shell [dev]
docker compose up
```
```shell [prod]
docker compose up -d && docker compose logs -t -f -n 100
```
:::

## 6. 手动初始化 NocoDB 和 MinIO 配置

#### 注意事项

- **pgAdmin 安装时间较长**：在 CPU 性能较低的服务器上，pgAdmin 的安装可能需要约 20 分钟，请耐心等待。
- **高效利用时间**：建议在等待 pgAdmin 安装完成的同时，先手动初始化 NocoDB 和 MinIO 的相关配置。

#### 具体步骤

1. **NocoDB 配置**
   - 打开 NocoDB 应用程序。
     - 在 `Integrations` 栏目中，新增您的数据源连接。
     - 进入 `Teams & Settings` > `Setup` > `Configure E-mail`，测试并验证 SMTP 邮件服务的配置是否正确。
     - 在用户界面的右上角下拉菜单中，选择 `Language` 以设置您 preferred 的显示语言。

2. **MinIO 配置**
   - 登录 MinIO 管理界面。
     - 创建所需的存储桶（Bucket）。
     - 生成新的访问密钥（Access Key）和秘密密钥（Secret Key）。

3. **NocoDB 中配置 MinIO 存储**
   - 在 NocoDB 的 `Integrations` 栏目中，找到并选择 MinIO 作为存储服务。
   - 输入之前在 MinIO 中创建的存储桶名称、访问密钥和秘密密钥，完成存储服务的集成配置。

通过以上步骤，您可以在等待 pgAdmin 安装的同时，高效地完成 NocoDB 和 MinIO 的基础配置工作。

## 其他

### NginX 反向代理 MinIO 配置文件参考

:::code-group

```nginx [miniosnsd.conf]
server {
    listen      443 ssl;
    listen      [::]:443 ssl;
    server_name libian-datalake-miniosnsd.yourhostname.com;
    ssl_certificate /etc/nginx/certificates/your/fullchain.cer;
    ssl_certificate_key /etc/nginx/certificates/your/cert.key;

    location / {
        proxy_pass https://localhost:18194/;

        proxy_ssl_server_name on;


        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Protocol $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-NginX-Proxy true;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        send_timeout 60s;
        proxy_headers_hash_max_size 2048;
        proxy_headers_hash_bucket_size 128;
    }
}
```

```nginx [minioconsole.conf]
server {
    listen      443 ssl;
    listen      [::]:443 ssl;
    server_name libian-datalake-minioconsole.yourhostname.com;
    ssl_certificate /etc/nginx/certificates/your/fullchain.cer;
    ssl_certificate_key /etc/nginx/certificates/your/cert.key;

    location / {
        proxy_pass https://localhost:18195/;
    
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Protocol $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-NginX-Proxy true;

        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
        proxy_headers_hash_max_size 2048;
        proxy_headers_hash_bucket_size 128;
    }
}
```

:::


