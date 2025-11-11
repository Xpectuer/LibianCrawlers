# -*- coding: UTF-8 -*-
from typing import *

from libiancrawlers.crawlers.smart_crawl.crawler_executor import CrawlerExecutor, SearchKeywordTaskData


class BilibiliCrawlerExecutor(CrawlerExecutor):
    @property
    def platform_alias(self) -> List[str]:
        return ['bili']

    @property
    def is_search_support(self) -> bool:
        return True


if __name__ == '__main__':
    pass
