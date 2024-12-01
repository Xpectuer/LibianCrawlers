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
deno run --allow-read --allow-write --allow-env --allow-net code_gen.ts
```


## 需求

自动化的数据清洗是个究极难题。它难就难在：

1. 各种数仓里的答辩数据什么都有。

   1. 答辩数据的一些答辩键值又与业务紧密耦合，比如 token、url …… 所以依然需要人来识别。
   2. 返回值啥都有，报错的、风控的、nullable 的……
   3. 类型系统不稳定，第三方 API 返回啥的都有。爬虫工程师和数据工程师之间有一道厚厚的类型之墙。

2. 代码结构与业务隐私组合的麻烦，不能把业务代码硬编码到仓库中。
   1. 有时有一些自己的秘密数据，想复用代码不方便。
   2. 但爬虫都写入仓库了，总得把对应的清洗代码放进去。

### 数仓细粒度权限

数仓的权限系统关系到自己的法律意义上的责任，因此不得不细心对待。

数仓的可读性可以如下划分:

#### `struct readble`: 类型可知

如果数据结构可以公开，那么可以提供一个接口用于数据处理。

> 请小心，一些 web 爬虫会携带账号信息，这可能被 quicktype 用作枚举值。
>
> 因此不应当直接对数仓数据的类型生成结果作为公开类型，而应当在 mapping 后公开。

#### `slice readble`: 切片可知

同上，应当在 filter mapping 后公开。

### 数据处理图

可以构建一个有向无环图用于数据处理。


