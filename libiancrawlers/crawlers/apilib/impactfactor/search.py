# -*- coding: UTF-8 -*-
import asyncio
from typing import Union, Tuple, Optional

from loguru import logger

from libiancrawlers.app_util.app_init import exit_app, init_app
from libiancrawlers.app_util.types import Initiator
from libiancrawlers.crawlers import CrawlMode, parse_mode, the_default_crawl_mode__save_file


async def search(*,
                 mode: CrawlMode = the_default_crawl_mode__save_file,
                 keywords: Union[str, Tuple[str]],
                 output_dir: Optional[str] = None,
                 dbfile: Optional[str] = None,
                 page_max: Optional[int] = None,
                 retry: int = 0,
                 ):
    """
    Param see:

    https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
    """

    from libiancrawlers.app_util.apicrawler_util import on_before_retry_default
    from libiancrawlers.app_util.apicrawler_util.search import SearchByKeywordContext, SearchByKeywordResult, \
        abstract_search

    is_save_file, is_insert_to_db = parse_mode(mode)
    init_app(Initiator(postgres=is_insert_to_db, playwright=False))

    loop = asyncio.get_event_loop()

    if page_max is not None and page_max < 0:
        page_max = None

    from impact_factor.core import Factor

    def _init_fa_sync(_dbfile: Optional[str]):
        if _dbfile is None:
            _fa = Factor()
        else:
            _fa = Factor(dbfile=_dbfile)
        return _fa

    fa = await loop.run_in_executor(None, _init_fa_sync, dbfile)
    logger.debug('fa.dbfile is {}', fa.dbfile)

    try:
        async def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
            def _search_sync(kwd):
                logger.debug('Start search {}', kwd)
                res = fa.search(kwd)
                logger.debug('Finish search {} , length is {}', kwd, len(res))
                return res

            result = await loop.run_in_executor(None, _search_sync, c.get('keyword'))

            return {
                'search_result': {
                    "obj": result,
                },
                'has_more': False
            }

        async def on_init():
            pass

        await abstract_search(
            mode=mode,
            keywords=keywords,
            output_dir=output_dir,
            page_max=page_max,
            page_size=None,
            page_size_ignore=True,
            fetch_all_content=False,
            fetch_all_comment=False,
            retry_max=retry,
            platform_id='github__suqingdong__impact_factor',
            crawler_tag='github__suqingdong__impact_factor',
            on_init=on_init,
            on_search_by_keyword=on_search_by_keyword,
            on_before_retry=on_before_retry_default,
        )
    finally:
        if _SHUTDOWN_AFTER_SEARCH:
            await exit_app()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
