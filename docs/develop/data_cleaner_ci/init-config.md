# 2-初始化配置文件

1. 首先，执行以下命令生成配置文件:

```shell
deno task init:config
```

生成的配置文件将保存在 `$HOME/.libian/crawler/config` 目录中，并创建符号链接到 `data_cleaner_ci_generated/config.json`。

2. 接下来，请更新配置文件，并设置您自己的数据仓库，比如 PostgreSQL 连接参数。

以下是一个配置文件模板。

:::code-group

```json [data_cleaner_ci\data_cleaner_ci_generated\config.json]
{
  "repositories": [
    {
      "typ": "postgres",
      "param": {
        "dbname": "SET_TO_YOUR",
        "user": "SET_TO_YOUR",
        "password": "SET_TO_YOUR",
        "host": "SET_TO_YOUR",
        "port": 5432,
        "ssl": true
      },
      "dataset_tables": [
        {
          "dataset_typename": "SET_TO_YOUR_LibianCrawlerGarbage",
          "schema": "libian_crawler",
          "tablename": "garbage",
          "group_by_jsonata": "g_type & '__' & g_content.crawler_tag",
          "batch_size": {
            "api": 200,
            "code_gen": 500
          },
          "cache_by_id": true,
          "with_jsonata_template": [
            "parse_html_tree"
          ]
        }
      ]
    }
  ],
  "libian_crawler": {
    "data_storage": {
      "connect_param": {
        "dbname": "SET_TO_YOUR",
        "user": "SET_TO_YOUR",
        "password": "SET_TO_YOUR",
        "host": "SET_TO_YOUR",
        "port": 5432,
        "ssl": true
      },
      "migration": {
        "schema": "libian_crawler_cleaned_migration",
        "table": "migration",
        "lock_table": "migration_lock"
      },
      "insert_batch_size": 100
    }
  }
}
```

:::
