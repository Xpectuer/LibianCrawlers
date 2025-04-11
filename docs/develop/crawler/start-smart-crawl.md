# 3-从命令行启动爬虫

## 爬虫功能模块完成进度

以下是爬虫模块完成进度表。

| 平台  | 爬取搜索菜单 | 清洗搜索菜单 | 爬取搜索结果的商品/帖子详情 | 清洗搜索结果的商品/帖子详情 | 爬取评论区 | 清洗评论区 |
|-----|--------|--------|----------------|----------------|-------|-------|
| 淘宝  | ✔️     | todo   | todo           | todo           | todo  | todo  |
| 拼多多 | ✔️     |        | ✔️             | ✔️             | todo  | todo  |
| 小红书 | ✔️     | todo   | ✔️             | todo           | todo  | todo  |
| 百度  | ✔️     | ✔️     | todo           | todo           |       |       |

## 命令参数

运行以下命令或查看源码以获取帮助。

```shell
poetry run smart-crawl --help
```

### 淘宝搜索

```shell
poetry run smart-crawl --debug --url https://www.taobao.com/ --locale zh-CN --steps jsonfile:steps/taobao-search.json?q=羽绒服
```

### 拼多多(mobile.yangkeduo.com)搜索

```shell
poetry run smart-crawl --debug --url https://mobile.yangkeduo.com/ --locale zh-CN --steps jsonfile:steps/yangkeduo-mobile-search.json?q=羽绒服
```

### 小红书搜索

```shell
poetry run smart-crawl --debug --url https://xiaohongshu.com/ --locale zh-CN --steps jsonfile:steps/xiaohongshu-search.json?q=丸子头
```

### 百度

```shell
poetry run smart-crawl --debug --url https://baidu.com/ --locale zh-CN --steps jsonfile:steps/baidu.json?q=吹风机
```