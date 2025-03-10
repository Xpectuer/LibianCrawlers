# 1-安装 Deno 和依赖

首先，打开 `LibianCrawlers/data_cleaner_ci/` 并将其作为运行命令的根目录。而不是在 `LibianCrawlers/` 下运行以下的命令。

```shell
cd data_cleaner_ci
```

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

如果你想知道有哪些定义好的任务，可以运行此命令以查看:

```shell
deno task
```
