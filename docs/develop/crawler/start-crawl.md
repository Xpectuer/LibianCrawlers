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

`--browser_data_dir_id` 用于指定不同的浏览器数据目录。同一时间只能启动一个数据目录相同的 Camoufox。

### 购物网站

#### 淘宝搜索

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | todo |
| 搜索结果的商品详情 | todo | todo |
| 商品详情评论区   | todo | todo |

```shell
poetry run smart-crawl --debug --url https://www.taobao.com/ --locale zh-CN --dump_page_ignore_names=svg --steps "jsonfile:steps/taobao-search.json?q=羽绒服" --mode save_file
```

#### 拼多多(mobile.yangkeduo.com)搜索

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | todo |
| 搜索结果的商品详情 | ✔️   | ✔️   |
| 商品详情评论区   | todo | todo |

```shell
poetry run smart-crawl --debug --url https://mobile.yangkeduo.com/ --locale zh-CN --dump_page_ignore_names=svg --steps "jsonfile:steps/yangkeduo-mobile-search.json?q=羽绒服" --mode save_file
```

### 社交媒体

#### 小红书搜索

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | todo |
| 搜索结果的帖子详情 | ✔️   | ✔️   |
| 评论区       | todo | todo |

```shell
poetry run smart-crawl --debug --url https://xiaohongshu.com/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/xiaohongshu-search.json?q=丸子头" --mode save_file
```

### 搜索引擎

#### 百度

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | ✔️   |
| 搜索结果的网站详情 | todo | todo |

```shell
poetry run smart-crawl --debug --url https://baidu.com/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/baidu.json?q=吹风机" --mode save_file
```

### 学术相关

#### 知网搜索

| 内容        | 爬取 | 清洗   |
|-----------|----|------|
| 搜索菜单      | ✔️ | todo |
| 搜索结果的文献详情 | ✔️ | ✔️   |
| 文献的期刊详情   | ✔️ | ✔️   |

```shell
poetry run smart-crawl --debug --url https://cnki.net/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/cnki-search.json?q=肺动脉高压" --mode save_file
```

#### Entrez 库搜索（PubMed）

| 内容   | api 请求 | 清洗 |
|------|--------|----|
| 查询论文 | ✔️     | ✔️ |

```shell
poetry run api-crawl-entrezapi-search --page_max 1000 --keywords "Pulmonary hypertension" --mode save_file
```

#### Embase 

##### 批量下载搜索结果

| 内容            | 下载导出的csv | 读取csv并入库 | 清洗 |
|---------------|----------|----------|----|
| 勾选的文献的 csv 文件 | ✔️       | ✔️       | ✔️ |

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale en-US --dump_page_ignore_names=script,svg --steps "jsonfile:steps/embase-search.json" --mode save_file
```

##### 根据 url 列表下载

```shell
poetry run api-crawl-pubmed-fetch-ids --data "lines_file/.data/pubmed_ids.txt"  --mode save_file
```

#### wos-journal 期刊信息查询

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 批量查询 | ✔️ | ✔️ |

将下方的 `--keys"` 改为你自己的 issn 字符串数组的 json 文件位置，
你可以使用 `--key2url_jsfunc` 传入 js 函数（仅支持 es5 语法）来映射 key 到 url 。

```shell
poetry run smart-crawl-urls --keys "jsonfile:data_cleaner_ci/user_code/journals_need_search/issn.json" --key2url_jsfunc "function(k){return 'https://wos-journal.info/?jsearch='+k.split(' ').join('+')}" --locale zh-CN --mode save_file
```

#### 维普搜索

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 文献详情 | ✔️ | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://www.cqvip.com/search?k=肺动脉高压" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/cqvip-search.json" --mode save_file
```

#### 万方搜索

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 文献详情 | ✔️ | ✔️ |
| 期刊详情 | ✔️ | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://s.wanfangdata.com.cn/paper?q=肺动脉高压" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/wanfangdata-search.json" --mode save_file
```

#### WebOfScience

##### 批量下载搜索结果

| 内容          | 下载 | 清洗 |
|-------------|----|----|
| 文献详情 xls 文件 | ✔️ | ✔️ |

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale en-US --dump_page_ignore_names=script,svg --steps "jsonfile:steps/webofscience-download.json" --mode save_file
```

##### 根据 url 列表下载

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale en-US --dump_page_ignore_names=script,svg --steps "jsonfile:steps/webofscience-download-paths.json?urls=read_from/lines_file/.data/wosurls.txt" --mode save_file
```

#### github.com/suqingdong/impactfactor 库搜索文献

> https://github.com/suqingdong/impact_factor

```shell
poetry run api-crawl-impactfactor-search --keywords "nature" --mode save_file
```


### 新闻媒体

#### Washington Post 搜索

> 用到的绕过付费限制插件：
>
> https://gitflic.ru/project/magnolia1234/bypass-paywalls-firefox-clean

| 内容   | meta 爬取 | 清洗 |
|------|---------|----|
| 资讯详情 | ✔️      | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://www.washingtonpost.com/search/?query=trump" --locale en-US --dump_page_ignore_names=script,svg --html2markdown_soup_find=article --steps "jsonfile:steps/washington-post-search.json" --addons_root_dir=".data/bypass_paywalls_clean" --mode save_file
```

#### 路透社 搜索

> 用到的绕过付费限制插件：
>
> https://gitflic.ru/project/magnolia1234/bypass-paywalls-firefox-clean

| 内容   | meta 爬取 | 清洗 |
|------|---------|----|
| 资讯详情 | ✔️      | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://www.reuters.com/site-search/?query=trump" --locale en-US --dump_page_ignore_names=script,svg --html2markdown_soup_find=article --steps "jsonfile:steps/reuters-search.json" --addons_root_dir=".data/bypass_paywalls_clean" --mode save_file
```

#### 美联社 搜索

| 内容   | meta 爬取 | 清洗 |
|------|---------|----|
| 资讯详情 | ✔️      | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://apnews.com/search?q=trump" --locale en-US --dump_page_ignore_names=script,svg --html2markdown_soup_find "main,.Page-body" --play_sound_when_gui_confirm --steps "jsonfile:steps/apnews-search.json" --mode save_file
```

### 其他

#### 千牛网页端聊天记录导出

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 聊天记录 | ✔️ | ✔️ |

参数 `start` 可以传入 `now` 或 `2025-5-25` 这种日期格式。

```shell
poetry run smart-crawl --debug --url https://qn.taobao.com/home.htm/app-customer-service/toolpage/Message --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/qianniu-message-export.json?start=now&step=-1" --mode save_file
```

