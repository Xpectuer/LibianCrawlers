# 2-配置文件初始化

此工程使用 [confection](https://github.com/explosion/confection) 框架解析 爬虫 和 worker 的配置文件。

在第一次执行数据采集时，如果没有在 `.data/config.cfg` 找到配置文件，则会自动生成一个配置文件在用户家目录下，通过符号链接（symlink）的方式链接到
`.data/config.cfg`，以便管理和访问。

以下是配置文件模板。

:::code-group

<<< @/../crawler_config_template.cfg{toml}

:::
