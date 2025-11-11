# -*- coding: UTF-8 -*-
from libiancrawlers.crawlers.smart_crawl.crawler_executor.platforms.bilibili import BilibiliCrawlerExecutor
from libiancrawlers.crawlers.smart_crawl.crawler_executor.platforms.xhs import XhsCrawlerExecutor


def get_all_crawler_executors():
    return [
        # BilibiliCrawlerExecutor(),
        XhsCrawlerExecutor()
    ]


if __name__ == '__main__':
    pass
