# 3.3-从调度器启动

## 启动 Worker

```shell
poetry run smart-crawl-compose  --worker --zookeeper_hosts "127.0.0.1:2181" --worker_bddid_to_acid login_xhs=my_xhs
```

## 提交关键字搜索任务

```shell
poetry run smart-crawl-compose --zookeeper_hosts "127.0.0.1:2181" --search_keywords "丸子头,狼尾发型"
```