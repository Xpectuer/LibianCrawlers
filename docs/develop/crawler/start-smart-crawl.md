# 3-启动爬虫

## 爬虫功能模块完成进度

以下是爬虫模块完成进度表。

| 平台   | 域名                 | 爬取搜索菜单 | 清洗搜索菜单 | 爬取商品详情 | 清洗商品详情 |
| ------ | -------------------- | ------------ | ------------ | ------------ | ------------ |
| 淘宝   | taobao.com           | ✔️           | todo         | todo         | todo         |
| 拼多多 | mobile.yangkeduo.com | ✔️           | todo         | ✔️           | ✔️           |

## 命令示例

### 淘宝

```shell
poetry run smart-crawl --debug --url https://www.taobao.com/ --locale zh-CN --steps jsonfile:steps/taobao-search.json?q=羽绒服
```

### 拼多多(mobile.yangkeduo.com)

```shell
poetry run smart-crawl --debug --url https://mobile.yangkeduo.com/ --locale zh-CN --steps jsonfile:steps/yangkeduo-mobile-search.json?q=羽绒服
```

### 小红书

```shell
poetry run smart-crawl --debug --url https://xiaohongshu.com/ --locale zh-CN --steps jsonfile:steps/xiaohongshu.json?q=丸子头
```
