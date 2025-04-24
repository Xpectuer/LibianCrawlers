# -*- coding: UTF-8 -*-
from typing import Union, Tuple, Optional

from bilibili_api.search import SearchObjectType, search_by_type
from loguru import logger

from libiancrawlers.app_util.types import Initiator
from libiancrawlers.app_util.app_init import exit_app, init_app


async def search(*,
                 keywords: Union[str, Tuple[str]],
                 page_max: Optional[int] = None,
                 search_type: str,
                 fetch_all_content: bool = False,
                 fetch_all_comment: bool = False,
                 retry: int = 0,
                 save_file_json_indent: int = 2,
                 ):
    from libiancrawlers.app_util.apicrawler_util import on_before_retry_default
    from libiancrawlers.app_util.apicrawler_util.search import SearchByKeywordContext, SearchByKeywordResult, \
        abstract_search

    search_type_allow = [e.value for e in SearchObjectType]
    if search_type not in search_type_allow:
        raise ValueError('search_type should be : %s' % (search_type_allow,))
    try:
        async def search_async(*, keyword, page):
            return await search_by_type(
                keyword=keyword,
                page=page,
                search_type=SearchObjectType(search_type),
                # debug_param_func=lambda it: logger.debug('Debug in bilibili_api.search.search_by_type : {}', it)
            )

        # search_sync = async_to_sync.function(search_async)

        async def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
            page = c.get('page')
            result = await search_async(
                keyword=c.get('keyword'),
                page=page,
            )

            return {
                'search_result': {
                    "search_type": search_type,
                    "obj": result,
                },
                'has_more': result.get('numPages', 1) > page
            }

        async def on_init():
            pass

        await abstract_search(
            keywords=keywords,
            page_max=page_max,
            page_size=None,
            fetch_all_content=fetch_all_content,
            fetch_all_comment=fetch_all_comment,
            retry_max=retry,
            platform_id='bilibili',
            crawler_tag='lib_bilibili-api-python',
            on_init=on_init,
            on_search_by_keyword=on_search_by_keyword,
            on_before_retry=on_before_retry_default,
            page_size_ignore=True,
        )
    finally:
        if _SHUTDOWN_AFTER_SEARCH:
            await exit_app()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    init_app(Initiator(postgres=True, playwright=False))
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
