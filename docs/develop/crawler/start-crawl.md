# 3-启动爬虫

[[toc]]

## 开发须知

::: danger
请务必阅读 [**《数据爬虫的罪与罚》**](./crawler-and-criminal-law.md) 以了解法律风险。

如果你的爬虫违反了上文中的 [**禁区**](./crawler-and-criminal-law.md#禁区)，请勿 PR 到此仓库，我也不会给你提供任何工具。

请务必参考 [**禁区**](./crawler-and-criminal-law.md#禁区) 了解 *DOM树的仓库* 。
:::

## 命令行启动参数文档

### 常用选项

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

## 命令行启动命令示例

### 购物网站

#### 淘宝搜索 <Badge type="tip" text="playwright" />

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | todo |
| 搜索结果的商品详情 | todo | todo |
| 商品详情评论区   | todo | todo |

```shell
poetry run smart-crawl --debug --url https://www.taobao.com/ --locale zh-CN --dump_page_ignore_names=svg --steps "jsonfile:steps/taobao-search.json?q=羽绒服" --mode save_file
```

#### 拼多多(mobile.yangkeduo.com)搜索 <Badge type="tip" text="playwright" />

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | todo |
| 搜索结果的商品详情 | ✔️   | ✔️   |
| 商品详情评论区   | todo | todo |

```shell
poetry run smart-crawl --debug --url https://mobile.yangkeduo.com/ --locale zh-CN --dump_page_ignore_names=svg --steps "jsonfile:steps/yangkeduo-mobile-search.json?q=羽绒服" --browser_data_dir_id login_pdd --mode save_file
```

### 社交媒体

#### 小红书搜索 <Badge type="tip" text="playwright" />

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | todo |
| 搜索结果的帖子详情 | ✔️   | ✔️   |
| 评论区       | todo | todo |

```shell
poetry run smart-crawl --debug --url https://xiaohongshu.com/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/xiaohongshu-search.json?q=丸子头" --browser_data_dir_id login_xhs --mode save_file
```

#### bilibili-api-python 封装 <Badge type="tip" text="api" />

:::tip 设置登录态

这里使用了多进程架构来分离需要登录和不需要登录的接口请求。（因为库本身只支持全局设置）

- 需要登录的接口将:
    - 不会使用代理
    - 速率较低。

- 不需要登录的接口将:
    - 会使用代理
    - 速率较高
    - 不会受用户账号本身的推荐信息影响

**以下是配置文件参考:**

具体含义参考 bilibili-api-python 官方文档:

https://nemo2011.github.io/bilibili-api/#/get-credential

配置文件内容示例。

```toml
[crawler.apilib]
[crawler.apilib.bilibili]
[crawler.apilib.bilibili.init_credential]
sessdata = ""
bili_jct = ""
buvid3 = ""
buvid4 = ""
dedeuserid = ""
ac_time_value = "" # 可以不填
```

:::

| 内容   | 清洗 |
|------|----|
| 视频信息 | ✔️ |

###### 根据一条 bvid 爬取视频信息

```shell
poetry run api-crawl-bilibili-read-video-info --is_insert_to_db --expire_time 36000 --bvid "BV1rdtizZEDE"
```

### 搜索引擎

#### 百度 <Badge type="tip" text="playwright" />

| 内容        | 爬取   | 清洗   |
|-----------|------|------|
| 搜索菜单      | ✔️   | ✔️   |
| 搜索结果的网站详情 | todo | todo |

```shell
poetry run smart-crawl --debug --url https://baidu.com/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/baidu.json?q=吹风机" --browser_data_dir_id no_trace_baidu --mode save_file
```

### 学术相关

#### 知网搜索 <Badge type="tip" text="playwright" />

| 内容        | 爬取 | 清洗   |
|-----------|----|------|
| 搜索菜单      | ✔️ | todo |
| 搜索结果的文献详情 | ✔️ | ✔️   |
| 文献的期刊详情   | ✔️ | ✔️   |

##### 单关键字

```shell
poetry run smart-crawl --debug --url https://cnki.net/ --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/cnki-search.json?q=肺动脉高压" --mode save_file
```

#### PubMed

##### Entrez 库搜索 <Badge type="tip" text="api" />

| 内容   | api 请求 | 清洗 |
|------|--------|----|
| 查询论文 | ✔️     | ✔️ |

- `--mindate` 和 `--maxdate` 可选。格式参考: https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch

```shell
poetry run api-crawl-entrezapi-search --page_max 1000 --keywords "Pulmonary hypertension" --mindate "2025/07/31" --maxdate "2025/08/31" --mode save_file
```

##### 根据 url 列表下载 <Badge type="tip" text="api" />

```shell
poetry run api-crawl-pubmed-fetch-ids --data "lines_file/.data/pubmed_ids.txt"  --mode save_file
```

#### Embase

##### 批量下载搜索结果 <Badge type="tip" text="playwright" />

| 内容            | 下载导出的csv | 读取csv并入库 | 清洗 |
|---------------|----------|----------|----|
| 勾选的文献的 csv 文件 | ✔️       | ✔️       | ✔️ |

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale en-US --dump_page_ignore_names=script,svg --steps "jsonfile:steps/embase-search.json" --mode save_file
```

#### wos-journal 期刊信息查询 <Badge type="tip" text="playwright" />

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 批量查询 | ✔️ | ✔️ |

将下方的 `--keys"` 改为你自己的 issn 字符串数组的 json 文件位置，
你可以使用 `--key2url_jsfunc` 传入 js 函数（仅支持 es5 语法）来映射 key 到 url 。

```shell
poetry run smart-crawl-urls --keys "jsonfile:data_cleaner_ci/user_code/journals_need_search/issn.json" --key2url_jsfunc "function(k){return 'https://wos-journal.info/?jsearch='+k.split(' ').join('+')}" --locale zh-CN --mode save_file
```

#### 维普搜索 <Badge type="tip" text="playwright" />

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 文献详情 | ✔️ | ✔️ |

##### 单关键字

```shell
poetry run smart-crawl --debug --url "https://www.cqvip.com/search?k=肺动脉高压" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/cqvip-search.json" --mode save_file
```

##### 多关键字

例如以以下关键字:

`'pulmonary hypertension' OR 'Sotatercept' OR 'ACE-011' OR 'ActRIIA-IgG1' OR 'ACTRIIA-Fc' OR 'MK-7962' OR 'RAP-011' OR 'ActRIIA-IgG1Fc' OR 'Activin receptor type IIA antagonist' OR 'activin signaling inhibition' OR 'activin signaling inhibitor' OR 'CTD-PAH' OR 'PAH-CHD'`

```shell
poetry run smart-crawl --debug --url "https://www.cqvip.com/search?k=%27pulmonary%20hypertension%27%20O
R%20%27Sotatercept%27%20OR%20%27ACE-011%27%20OR%20%27ActRIIA-IgG1%27%20OR%20%27ACTRIIA-Fc%27%20OR%20%27MK-7962%27%20OR%20%27RAP-011%27%20OR%20%27ActRIIA-IgG1Fc%27%20OR%20%27A
ctivin%20receptor%20type%20IIA%20antagonist%27%20OR%20%27activin%20signaling%20inhibition%27%20OR%20%27activin%20signaling%20inhibitor%27%20OR%20%27CTD-PAH%27%20OR%20%27PAH-CHD%27&ex=false" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/cqvip-search.json" --mode all
```

#### 万方搜索 <Badge type="tip" text="playwright" />

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 文献详情 | ✔️ | ✔️ |
| 期刊详情 | ✔️ | ✔️ |

##### 单关键字

```shell
poetry run smart-crawl --debug --url "https://s.wanfangdata.com.cn/paper?q=肺动脉高压" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/wanfangdata-search.json" --mode save_file
```

#### WebOfScience

##### 批量下载搜索结果 <Badge type="tip" text="playwright" />

| 内容          | 下载 | 清洗 |
|-------------|----|----|
| 文献详情 xls 文件 | ✔️ | ✔️ |

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale en-US --dump_page_ignore_names=script,svg --steps "jsonfile:steps/webofscience-download.json" --mode save_file
```

##### 根据 url 列表下载 <Badge type="tip" text="playwright" />

```shell
poetry run smart-crawl --debug --url "可改为二道贩子跳板网站地址以便手动登录" --locale en-US --dump_page_ignore_names=script,svg --steps "jsonfile:steps/webofscience-download-paths.json?urls=read_from/lines_file/.data/wosurls.txt" --mode save_file
```

#### github-com-suqingdong-impact-factor

> https://github.com/suqingdong/impact_factor

#### 搜索文献 <Badge type="tip" text="api" />

```shell
poetry run api-crawl-impactfactor-search --keywords "nature" --mode save_file
```

### 新闻媒体

#### Washington Post 搜索 <Badge type="tip" text="playwright" />

> 用到的绕过付费限制插件：
>
> https://gitflic.ru/project/magnolia1234/bypass-paywalls-firefox-clean

| 内容   | meta 爬取 | 清洗 |
|------|---------|----|
| 资讯详情 | ✔️      | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://www.washingtonpost.com/search/?query=trump" --locale en-US --dump_page_ignore_names=script,svg --html2markdown_soup_find=article --steps "jsonfile:steps/washington-post-search.json" --addons_root_dir=".data/bypass_paywalls_clean" --browser_data_dir_id read_washington_post --mode save_file
```

#### 路透社 搜索 <Badge type="tip" text="playwright" />

> 用到的绕过付费限制插件：
>
> https://gitflic.ru/project/magnolia1234/bypass-paywalls-firefox-clean

| 内容   | meta 爬取 | 清洗 |
|------|---------|----|
| 资讯详情 | ✔️      | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://www.reuters.com/site-search/?query=trump" --locale en-US --dump_page_ignore_names=script,svg --html2markdown_soup_find=article --steps "jsonfile:steps/reuters-search.json" --addons_root_dir=".data/bypass_paywalls_clean" --browser_data_dir_id read_reuters --mode save_file
```

#### 美联社 搜索 <Badge type="tip" text="playwright" />

| 内容   | meta 爬取 | 清洗 |
|------|---------|----|
| 资讯详情 | ✔️      | ✔️ |

```shell
poetry run smart-crawl --debug --url "https://apnews.com/search?q=trump" --locale en-US --dump_page_ignore_names=script,svg --html2markdown_soup_find "main,.Page-body" --play_sound_when_gui_confirm --steps "jsonfile:steps/apnews-search.json" --browser_data_dir_id read_apnews --mode save_file
```

#### 雪球

##### 搜索单关键字 <Badge type="tip" text="playwright" />

| 内容     | 爬取 | 清洗   |
|--------|----|------|
| 搜索结果列表 | ✔️ | TODO |

```shell
poetry run smart-crawl --debug --url "https://xueqiu.com/k?q=trump" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/scroll-down-v1.json" --browser_data_dir_id read_xueqiu --mode save_file
```

##### 搜索多关键字 <Badge type="tip" text="playwright" />

```shell
poetry run smart-crawl-urls --keys "jsonfile:.data/media_search_keywords.json5" --key2url_jsfunc "function(k){return 'https://xueqiu.com/k?q='+k.split(' ').join('+')}" --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/scroll-down-v1.json" --browser_data_dir_id read_xueqiu --mode save_file
```

### 其他

#### 千牛网页端聊天记录导出 <Badge type="tip" text="playwright" />

| 内容   | 爬取 | 清洗 |
|------|----|----|
| 聊天记录 | ✔️ | ✔️ |

参数 `start` 可以传入 `now` 或 `2025-5-25` 这种日期格式。

```shell
poetry run smart-crawl --debug --url https://qn.taobao.com/home.htm/app-customer-service/toolpage/Message --locale zh-CN --dump_page_ignore_names=script,svg --steps "jsonfile:steps/qianniu-message-export.json?start=now&step=-1" --browser_data_dir_id login_qianniu --mode save_file
```

### LLM Chat

#### Gemini Deep Research <Badge type="tip" text="playwright" />

脚本参数:

- `enable_answer_collect=yes` 将收集近期对话内容。
- `enable_query=yes` 将启用 Deep Research 提问。
- `q` 为要提问的问题。
- `enable_wait_report=yes` 将等待并点击“开始研究”。

示例:

- 提问并开始研究，然后收集近期对话内容。

```shell
poetry run smart-crawl --debug --url https://gemini.google.com/app --locale en-US --screen_min_width 1200 --screen_max_height 1000 --dump_page_ignore_names=script,svg --browser_data_dir_id login_gemini --mode save_file --steps "jsonfile:steps/gemini-deep-research.json?enable_answer_collect=yes&enable_query=yes&q=明朝灭亡的原因&enable_wait_report=yes" 
```

- 仅提问。

```shell
poetry run smart-crawl --debug --url https://gemini.google.com/app --locale en-US --screen_min_width 1200 --screen_max_height 1000 --dump_page_ignore_names=script,svg --browser_data_dir_id login_gemini --mode save_file --steps "jsonfile:steps/gemini-deep-research.json?enable_answer_collect=no&enable_query=yes&q=明朝灭亡的原因&enable_wait_report=yes" 
```

- 仅收集近期对话内容。

```shell
poetry run smart-crawl --debug --url https://gemini.google.com/app --locale en-US --screen_min_width 1200 --screen_max_height 1000 --dump_page_ignore_names=script,svg --browser_data_dir_id login_gemini --mode save_file --steps "jsonfile:steps/gemini-deep-research.json?enable_answer_collect=yes&enable_query=no&q=0&enable_wait_report=no"
```


