# 3-启动爬虫

## 爬虫功能模块完成进度

以下是爬虫模块完成进度表。

常用选项:

`--help` 可以展示帮助。

`--mode` 可以设置输出模式。

- **缺省值** 是 `'save_file'` 即保存到本地文件。
- `'insert_to_db'` 表示写入远程数据仓库。
- **常用**: `'all'` 或 `'save_file_and_insert_to_db'`
  表示既保存到本地文件又写入远程数据仓库。

`--debug` 可以在 发生异常时 或 "debug" 指令时暂停。

`--dump_page_ignore_names` 用于忽略该名称的 html element。

> 例如传入 `--dump_page_ignore_names=script,svg` 可令 dump_page 忽略 script 和
> svg 标签及子标签。

### 淘宝搜索

| 内容               | 爬取 | 清洗 |
| ------------------ | ---- | ---- |
| 搜索菜单           | ✔️   | todo |
| 搜索结果的商品详情 | todo | todo |
| 商品详情评论区     | todo | todo |

```shell
poetry run smart-crawl --debug --url https://www.taobao.com/ --locale zh-CN --dump_page_ignore_names=svg --steps "jsonfile:steps/taobao-search.json?q=羽绒服" --mode save_file
```

### 拼多多(mobile.yangkeduo.com)搜索

| 内容               | 爬取 | 清洗 |
| ------------------ | ---- | ---- |
| 搜索菜单           | ✔️   | todo |
| 搜索结果的商品详情 | ✔️   | ✔️   |
| 商品详情评论区     | todo | todo |

```shell
poetry run smart-crawl --debug --url https://mobile.yangkeduo.com/ --locale zh-CN --dump_page_ignore_names=svg --steps "jsonfile:steps/yangkeduo-mobile-search.json?q=羽绒服" --mode save_file
```

### 小红书搜索

| 内容               | 爬取 | 清洗 |
| ------------------ | ---- | ---- |
| 搜索菜单           | ✔️   | todo |
| 搜索结果的帖子详情 | ✔️   | ✔️   |
| 评论区             | todo | todo |

```shell
poetry run smart-crawl --debug --url https://xiaohongshu.com/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/xiaohongshu-search.json?q=丸子头" --mode save_file
```

### 百度

| 内容               | 爬取 | 清洗 |
| ------------------ | ---- | ---- |
| 搜索菜单           | ✔️   | ✔️   |
| 搜索结果的网站详情 | todo | todo |

```shell
poetry run smart-crawl --debug --url https://baidu.com/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/baidu.json?q=吹风机" --mode save_file
```

### 知网搜索

| 内容               | 爬取 | 清洗 |
| ------------------ | ---- | ---- |
| 搜索菜单           | ✔️   | todo |
| 搜索结果的文献详情 | ✔️   | ✔️   |
| 文献的期刊详情     | ✔️   | ✔️   |

```shell
poetry run smart-crawl --debug --url https://cnki.net/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/cnki-search.json?q=肺动脉高压" --mode save_file
```

### Entrez 库搜索

| 内容     | 爬取 | 清洗 |
| -------- | ---- | ---- |
| 查询论文 | ✔️   | ✔️   |

```shell
poetry run api-crawl-entrezapi-search --page_max 1000 --keywords "Pulmonary hypertension" --mode save_file
```

### 千牛网页端聊天记录导出

| 内容     | 爬取 | 清洗 |
| -------- | ---- | ---- |
| 聊天记录 | ✔️   | ✔️   |

```shell
poetry run smart-crawl --debug --url https://qn.taobao.com/home.htm/app-customer-service/toolpage/Message --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/qianniu-message-export.json?start=now&step=-1" --mode save_file
```

参数 `start` 可以传入 `now` 或 `2025-5-25` 这种日期格式。

### Embase 及镜像站搜索并下载

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/embase-search.json" --mode save_file
```

| 内容     | 下载导出的csv | 读取csv并入库 | 清洗 |
| -------- | ------------- | ------------- | ---- |
| 聊天记录 | ✔️            | ✔️            | ✔️   |
