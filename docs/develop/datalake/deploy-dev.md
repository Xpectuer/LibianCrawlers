# 1-在本机Docker开发环境部署数据湖

本文描述了如何在本地开发环境部署 LibianDatalake 数据湖。

## 1. 创建环境变量文件

第一步，先创建好 `.env` 文件。它之后会被 shell 命令与 `docker-compose.yml` 读取。

:::warning

⚠️ 以下 `.env` 文件中的值仅作为开发环境使用，切勿使用于生产环境。

:::

:::code-group

```bash
echo '
<!--@include: ./template.dev.env-->
' > .env
```

<<< @/develop/datalake/template.dev.env {.dotenv}[.env]
:::

然后使用以下命令读入并检查 `.env` 中的环境变量。

:::code-group

```bash
[ ! -f .env ] || export $(grep -v '^#' .env | xargs) && echo $POSTGRES_HOSTNAME
```

```shell
export $(cat .env | xargs) && echo $POSTGRES_HOSTNAME
```

:::

## 2. 创建 MinIO 配置文件

MinIO 的单节点单磁盘（SNSD, Single Node Single Drive）部署模式需要通过配置文件来指定运行环境参数。为此，我们需要创建并导入必要的环境变量。

根据 [MinIO 官方文档](https://min.io/docs/minio/container/operations/install-deploy-manage/deploy-minio-single-node-single-drive.html#create-the-environment-variable-file)
，请按照以下步骤操作:

```bash
[ ! -f .env ] || export $(grep -v '^#' .env | xargs) && \
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

## 3. 创建 pgadmin4 数据目录并设置用户权限

为了确保pgAdmin4容器能够正确运行并管理数据库，需要在启动容器之前，预先创建必要的存储卷目录，并设置正确的用户和权限。

:::tip 为什么需要预先创建存储卷

pgAdmin4容器通常以非root用户身份运行（例如UID:
5050），因此宿主机上的存储卷目录必须与容器内部的用户环境保持一致，以确保容器内的进程能够正确访问和修改这些目录下的文件。如果不预先设置正确的用户组和权限，可能会导致容器无法写入数据或出现其他权限相关的问题。

可参考 [pgAdmin 官方文档](https://www.pgadmin.org/docs/pgadmin4/latest/container_deployment.html#mapped-files-and-directories)
了解更多。

:::

```bash
[ ! -f .env ] || export $(grep -v '^#' .env | xargs) && \
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
            \"SSLMode\": \"disable\",
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
CONFIG_DATABASE_URI='postgresql://$POSTGRES_USERNAME:$POSTGRES_PASSWORD@$POSTGRES_HOSTNAME:5432/$POSTGRES_DB?application_name=libian-datalake-pgadmin-config&sslmode=disable'


# Change log level
CONSOLE_LOG_LEVEL = logging.INFO
FILE_LOG_LEVEL = logging.INFO

" > ./volume/pgadmin_config/config_local.py && \
  cat ./volume/pgadmin_config/servers.json && \
  cat ./volume/pgadmin_config/pgpass && \
  cat ./volume/pgadmin_config/config_local.py && \
  chmod 644 ./volume/pgadmin_config/servers.json && \
  chmod 644 ./volume/pgadmin_config/config_local.py && \
  chmod 600 ./volume/pgadmin_config/pgpass && \
  sudo chown -R 5050:5050 ./volume/pgadmin_config/servers.json && \
  sudo chown -R 5050:5050 ./volume/pgadmin_config/pgpass && \
  sudo chown -R 5050:5050 ./volume/pgadmin_config/config_local.py && \
  sudo chown -R 5050:5050 ./volume/pgadmin_data && \
  sudo chown -R 5050:5050 ./volume/pgadmin_config && \
  ls -la volume/*
```

## 4. Docker Compose 部署

### 4.1 创建 docker-compose.yml 文件

第四步，创建 `docker-compose.yml`。

:::code-group

```shell
echo '
<!--@include: ./docker-compose.dev.yml-->
' > docker-compose.yml
```

<<< @/develop/datalake/docker-compose.dev.yml

:::

### 4.2 运行

运行此命令以部署:

```shell [dev]
docker compose up
```

## 5. 最后

| 服务        | 地址                     | 管理员账号                                 | 管理员密码                          | 备注                                                             |
|-----------|------------------------|---------------------------------------|--------------------------------|----------------------------------------------------------------|
| postgres  | localhost:18191        | `postgres`                            | `libian-datalake-dev-password` | 登陆时语言一定要选 `English`                                            |
| pgadmin   | http://localhost:18192 | `pgadmin-libian-datalake@example.com` | `libian-datalake-dev-password` |                                                                |
| nocodb    | http://localhost:18193 | `ncadmin-libian-datalake@example.com` | `libian-datalake-dev-password` | 需要参照 [First-Init](./deploy-pro.md#first-init) 配置 postgres 数据源。 |
| minio     | localhost:18194        |                                       |                                | 需去控制台配置 `access_key` 和 `secret_key`                            |
| minio 控制台 | http://localhost:18195 | `myminioadmin`                        | `libian-datalake-dev-password` |                                                                |



