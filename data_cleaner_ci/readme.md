# 数据清洗 CI

## 启动工程

### 1. 安装 deno 和依赖。

先安装 deno:

https://docs.deno.com/runtime/getting_started/installation/

建议使用 >2.1.2 的版本。

```shell
deno --version
```

然后安装依赖。

```shell
deno install
```

### 2. 启动代码生成

> 代码生成脚本将会为你执行以下操作:
> 
> 1. 创建 `./data_cleaner_ci_generated/` 目录和 `./user_code/` 符号链接目录。这两个目录已被 `.gitignore` 排除，不会被代码管理。
> 
> 2. 在 `./data_cleaner_ci_generated/` 目录中执行以下操作：
> 
>    - 生成配置文件并保存到用户家目录的配置中，然后将配置文件符号链接至 `./data_cleaner_ci_generated/config.json`，以便进行 TypeScript 类型检查。
> 
>    - 根据配置文件内容，在 `./data_cleaner_ci_generated` 目录下生成数仓中的数据类型和接口 API。
> 
> 3. 创建私人代码目录 `$HOME/.libian/crawler/data_cleaner_ci/user_code` 并将其符号链接至 `./user_code/`。
> 
>    - 以便进行 TypeScript 类型检查。
> 
>    - 其他公共脚本需要从 `./user_code/` 目录中导入类型，以免私人代码中的类型名称直接被公共代码使用。

1. 首先，执行以下命令生成配置文件:

```shell
deno run init_config.ts
```

生成的配置文件将保存在 `$HOME/.libian/crawler/config` 目录中，并创建符号链接到 `data_cleaner_ci_generated/config.json`。

2. 接下来，请更新配置文件，并在 `repositories` 键数组中设置您自己的数据仓库，比如 PostgreSQL 连接参数。

3. 在设置好数据仓库后，执行以下命令以生成数仓的 API代码:

```shell
deno run --allow-env=PG*,READABLE_STREAM,CI,TSC_*,NODE_INSPECTOR_IPC,VSCODE_INSPECTOR_OPTIONS,NODE_ENV --allow-read=./data_cleaner_ci_generated --allow-write=./data_cleaner_ci_generated code_gen.ts
```

4. 完成上述三个步骤后，初始化工作就已经完成。然而，如果您需要适配并运行 `general_data_process` 目录下的公用脚本，您需要手动处理 TypeScript 类型导入。

您可以通过运行以下命令检查生成后的文件和公用脚本的类型适配情况：

```shell
deno check --all **/*.ts
```

您可以运行一下测试，看看一切是否正常:

```shell
deno test
```

## 数据清洗的详细步骤 - 以 libian_crawler 为例

由于每个开发人员的数据库连接配置不同，因此请将自己的设置写在 `data_cleaner_ci_generated/config.json` 中，并且将其排除在版本管理外。

然后检查一下类型系统有没有报错，如果报错的话可能是因为数仓的数据类型发生了变化、也可能是初始化后缺配置，需要手动调整。

```shell
deno check --all general_data_process/libian_crawler/clean_and_merge.ts
```

没问题的话就运行。

```shell
deno run --allow-env=PG* --allow-read=data_cleaner_ci_generated/.cache_by_id  general_data_process/libian_crawler/clean_and_merge.ts
```

`clean_and_merge.ts` 脚本会先运行数据库迁移（在 `general_data_process/libian_crawler/migrations/` 目录下），
然后读取在 `user_code/LibianCrawlerGarbage.ts` 中指定的迭代器，然后合并ID相同的多条数据（可能时间不同、也可能爬了很多次），
最后将合并后的结果增量更新到 Postgres 中。



<!-- ## 需求

自动化的数据清洗是个究极难题。它难就难在：

1. 各种数仓里的答辩数据什么都有。

   1. 答辩数据的一些答辩键值又与业务紧密耦合，比如 token、url …… 所以依然需要人来识别。
   2. 返回值啥都有，报错的、风控的、nullable 的……
   3. 类型系统不稳定，第三方 API 返回啥的都有。爬虫工程师和数据工程师之间有一道厚厚的类型之墙。
   4. 解决方法: 使用 `typescript` 和 `quicktype` 来生成健壮的类型代码，并辅之以 `jsonata` 来做些便于区分 union type 的分组。

2. 代码结构与业务隐私组合的麻烦，不能把业务代码硬编码到仓库中。

   1. 有时有一些自己的秘密数据，想复用代码不方便。
   2. 但爬虫都写入仓库了，总得把对应的清洗代码放进去。
   3. 解决方法: 使用 `init_config.ts` 脚本来生成用户个人代码区域。

3. 把初次对齐列的数据去重合并。例如根据去重 ID 合并。

4. 对清洗好的数据做后续的业务，例如继续爬取详情、调用 AI 总结、OCR、转文字…… -->
