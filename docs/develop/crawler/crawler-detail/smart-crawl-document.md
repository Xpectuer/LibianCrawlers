# 详解 smart-crawl 脚本

## 命令行启动参数文档

具体入参请参考:

* https://github.com/Xpectuer/LibianCrawlers/blob/main/libiancrawlers/crawlers/smart_crawl/smart_crawl.py

### 必填选项

#### url

`--url` 初次打开的页面。

#### locale

`--locale` 指定浏览器语言环境，比如 `"zh-CN"` 或 `"en-US"`。

也可以设为 `"proxy"` 以根据代理自动选择。

### 常用选项

#### help

`--help` 可以展示帮助。

#### mode

`--mode` 可以设置输出模式。

缺省值是 `'save_file'` 即保存到本地文件。

`'insert_to_db'` 表示写入远程数据仓库。

常用 `'all'` 或 `'save_file_and_insert_to_db'`
表示既保存到本地文件又写入远程数据仓库。

#### debug

`--debug` 可以在 发生异常时 或 "debug" 指令时暂停。

#### browser_data_dir_id

`--browser_data_dir_id` 用于指定不同的浏览器数据目录。

即控制 Camoufox 的 `launch_options['user_data_dir']`
和 [persistent_context](https://camoufox.com/python/usage/#persistent_context) 选项。

可以传入 `"nil"` 代表不传入，这会使 Camoufox 不使用 persistent_context 选项，即不使用浏览器环境存储。

如果未指定，则使用默认值 `"smart-crawl-v1-default-browser-data-dir-id"`。

因此，同一时间只能启动一个数据目录相同的 Camoufox 。 如果同时启动两个 browser_data_dir_id 相同的（都不填即默认值相同也算）
smart-crawl 脚本，则后启动的会报错结束。

#### steps

`--steps` 指定脚本文件。

:::info 传入值规范
TODO: 此文档尚待编写...

其传入值的格式丰富多样。不过我懒得写了。

具体逻辑参考 [libiancrawlers/app_util/cmdarg_util.py](https://github.com/Xpectuer/LibianCrawlers/blob/main/libiancrawlers/app_util/cmdarg_util.py)
的 `parse_json_or_read_file_json_like` 函数。
:::

:::info 所指定的脚本文件的规范
脚本文件规范参考 [steps.md](./steps.md)
:::

#### wait_until_close_browser

`--wait_until_close_browser` 可以在 因脚本完成或发生异常时而停止时 ，等待手动关闭浏览器后才退出进程。

> 你也可以用 `--debug` 替代（但 `--debug` 功能更杂）。

#### 浏览器 screen 限制

可以用于限制 Camoufox 浏览器视口随机指纹的最大最小范围。

- `--screen_max_height`
- `--screen_max_width`
- `--screen_min_height`
- `--screen_min_width`

#### html2markdown_soup_find

`--html2markdown_soup_find` 用于指定会把匹配的元素转为 markdown 并塞到爬取的数据中。

其会使用 `BeautifulSoup.select_one()` 来在 html 中选择元素。

可以使用逗号分隔以传入多个值，将会使用第一个找到的值。

适用场景：这通常 **很适合h5语义化做的很好的网站** 。因为 h5 直接转 markdown 就可以在省下数据清洗时的负担。

### 非常用选项

#### output_dir

`--output_dir` 输出目录，默认为 `os.path.join('.data', 'smart-crawl-v1')`

#### 具体输出 tag

`--tag_group` 和 `--tag_version` 是用于分类的选项。

会影响:

- 输出目录下的具体输出的文件夹。
- 输出对象的 json 字段中也会带有 `crawler_tag` 信息。

这里面逻辑复杂，建议阅读源码。一般无需更改。

#### save_file_json_indent

`--save_file_json_indent` 保存到文件时的 json indent 。默认值为 `2`

#### dump_page_ignore_names

`--dump_page_ignore_names` 用于忽略该名称的 html element。

例如传入 `--dump_page_ignore_names=script,svg` 可令 dump_page 忽略 script 和 svg 标签及子标签。

#### addons_root_dir

`--addons_root_dir` 是 启用的浏览器扩展 的查找目录。

查找的逻辑是根据是否存在 `manifest.json` 来判断是否是插件目录。

#### play_sound_when_gui_confirm

:::TODO 尚未实现
此功能尚待开发...
:::

`--play_sound_when_gui_confirm` 意图是在 gui_confirm 步骤时发出提示音乐。

通常用于在需要人工过验证码时催促程序员。
