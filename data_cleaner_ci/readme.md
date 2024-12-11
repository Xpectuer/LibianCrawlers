# 数据清洗与计算 CI

## 启动工程

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

然后初始化配置文件。

```shell
deno run init_config.ts
```

然后启动类型生成。

```shell
deno run --allow-env=PG*,READABLE_STREAM,CI --allow-read=./data_cleaner_ci_generated --allow-write=./data_cleaner_ci_generated code_gen.ts
```

## 需求

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

3. 把初次对齐列的数据去重合并。例如根据去重ID合并。

4. 对清洗好的数据做后续的业务，例如继续爬取详情、调用AI总结、OCR、转文字……



