# 详解 smart-crawl-urls 脚本

smart-crawl-urls 脚本的功能是遍历 url 列表，并传给 [smart-crawl 的 url 参数](./smart-crawl-document.md#url) 的子进程命令行参数。
然后一个一个进行爬取。

其除了以下 [自身特有的命令行参数](#自身特有的命令行参数)
外的其他参数都会被传给 [smart-crawl 的命令行参数](./smart-crawl-document.md#命令行启动参数文档)。

## 自身特有的命令行参数

### keys

`--keys <source>` 必填。传入列表信息。

> TODO: source 格式介绍

### key2url_jsfunc

`--key2url_jsfunc <js_function_string>` 可选。传入一个 javascript 函数（仅支持 es5 语法），将读取到的 keys 列表使用此函数进行
Mapping 输出。

### retry_count_default

`--retry_count_default <number>` 可选。重试次数。默认值为 `5`。

### retry_always

`--retry_always` 可选。启用此选项后，在重试次数用尽后，不会退出进程，而是弹出 `gui_confirm` 窗口，当程序员确认此窗口后重置重试次数并继续重试。

## 示例 wos-journal 期刊信息查询

第一步，同时启动查询 `data_cleaner_ci/user_code/` 符号链接目录下的 `journals_need_search/` 目录下的:

- `issn.json`
- `eissn.json`
- `journal_name.json`

并将查询结果保存到数据库和结果文件。

> 这些文件是由 data_cleaner_ci 清洗后的再通过其他脚本联表合并的。

:::code-group

```shell [查询 issn]
poetry run smart-crawl-urls --screen_max_height 1000 --key2url_jsfunc "function(k){return 'https://wos-journal.info/?jsearch='+k.split(' ').join('+')}" --locale zh-CN --screen_max_height 1000 --retry_always --keys "jsonfile:data_cleaner_ci/user_code/journals_need_search/issn.json" --browser_data_dir_id no_trace_wos_journal_1 --mode all
```

```shell [查询 eissn]
poetry run smart-crawl-urls --screen_max_height 1000 --key2url_jsfunc "function(k){return 'https://wos-journal.info/?jsearch='+k.split(' ').join('+')}" --locale zh-CN --screen_max_height 1000 --retry_always --keys "jsonfile:data_cleaner_ci/user_code/journals_need_search/eissn.json" --browser_data_dir_id no_trace_wos_journal_2 --mode all
```

```shell [查询 journal_name]
poetry run smart-crawl-urls --screen_max_height 1000 --key2url_jsfunc "function(k){return 'https://wos-journal.info/?jsearch='+k.split(' ').join('+')}" --locale zh-CN --screen_max_height 1000 --retry_always --keys "jsonfile:data_cleaner_ci/user_code/journals_need_search/journal_name.json" --browser_data_dir_id no_trace_wos_journal_3 --mode all
```

:::

（此功能尚实现）在完成期刊信息查询后，将已经查过的那三个文件复制为 `*.already.json` 后缀。

下次爬取时将会过滤掉这些已经查过的 keys。

```shell
cp data_cleaner_ci/user_code/journals_need_search/issn.json data_cleaner_ci/user_code/journals_need_search/issn.already.json

cp data_cleaner_ci/user_code/journals_need_search/eissn.json data_cleaner_ci/user_code/journals_need_search/eissn.already.json

cp data_cleaner_ci/user_code/journals_need_search/journal_name.json data_cleaner_ci/user_code/journals_need_search/journal_name.already.json
```