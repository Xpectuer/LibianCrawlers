# -*- coding: UTF-8 -*-
from typing import Union, Tuple

from bilibili_api.search import SearchObjectType
from loguru import logger


async def search(*,
                 keywords: Union[str, Tuple[str]],
                 search_type: str,
                 fetch_all_content: bool = False,
                 fetch_all_comment: bool = False,
                 retry: int = 0,
                 ):
    from libiancrawlers.common import on_before_retry_default
    from libiancrawlers.common.postgres import close_global_pg_pool
    from libiancrawlers.common.search import SearchByKeywordContext, SearchByKeywordResult, abstract_search

    search_type_allow = [e.value for e in SearchObjectType]
    if search_type not in search_type_allow:
        raise ValueError('search_type should be : %s' % (search_type_allow,))

    async def search_async(*, keyword, page):
        return await search_by_type(
            keyword=keyword,
            page=page,
            search_type=SearchObjectType(search_type),
            debug_param_func=lambda it: logger.debug('Debug in bilibili_api.search.search_by_type : {}', it)
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

    if _SHUTDOWN_AFTER_SEARCH:
        logger.debug('shutdown after Fire(search)')
        await close_global_pg_pool()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
