# 2-初始化配置文件

1. 首先，执行以下命令生成配置文件:

```shell
deno task init:config
```

生成的配置文件将保存在 `$HOME/.libian/crawler/config` 目录中，并创建符号链接到 `data_cleaner_ci_generated/config.json`。

2. 接下来，请更新配置文件，并在 `repositories` 键数组中设置您自己的数据仓库，比如 PostgreSQL 连接参数。
