# 2-在启动之前做好配置

在第一次执行数据采集时，如果没有在 `.data/config.cfg` 找到配置文件，则会自动生成一个配置文件在用户家目录下，通过符号链接（symlink）的方式关联到 `.data/config.cfg`，以便管理和访问。

以下是一个配置文件模板。

:::code-group

```toml [.data/config.cfg]
[vars]
search-page-max=3
search-page-size=20

[vars.pg]
dbname="set to your"
user="set to your"
password="set to your"
host="set to your"
port="set to your"

[camoufox]

[crawler]

[crawler.postgres]
dbname=${vars.pg.dbname}
user=${vars.pg.user}
password=${vars.pg.password}
host=${vars.pg.host}
port=${vars.pg.port}

[crawler.gecko]
profile-dir-base="{{HOME}}/.libian/crawler/gecko-profile"

[crawler.minio]
endpoint=""
access_key=""
secret_key=""
secure=true
```

:::
