# -*- coding: UTF-8 -*-

from libiancrawlers.crawlers.smart_crawl.crawler_executor.scc_main import smart_crawl_compose


def cli():
    from fire import Fire
    Fire(smart_crawl_compose)


if __name__ == '__main__':
    pass
