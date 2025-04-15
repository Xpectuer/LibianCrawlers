# 4-启动数据清洗-以 libian_crawler 为例

由于每个开发人员的数据库连接配置不同，因此请将自己的设置写在 `data_cleaner_ci_generated/config.json` 中，并且将其排除在版本管理外。

然后检查一下类型系统和测试用例有没有报错，如果报错的话可能是因为数仓的数据类型发生了变化、也可能是初始化后缺配置，需要手动调整。

```shell
deno task step:check
```

没问题的话就运行。

```shell
deno task run:libian_crawler
```

`clean_and_merge.ts` 脚本会先运行数据库迁移（在 `general_data_process/libian_crawler/migrations/` 目录下），
然后读取在 `user_code/LibianCrawlerGarbage.ts` 中指定的迭代器，然后合并 ID 相同的多条数据（可能时间不同、也可能爬了很多次），
最后将合并后的结果增量更新到 Postgres 中。
