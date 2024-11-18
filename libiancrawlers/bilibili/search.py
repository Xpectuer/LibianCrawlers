# -*- coding: UTF-8 -*-
import time
from typing import Union, Tuple
from bilibili_api.search import SearchObjectType, search_by_type
from loguru import logger

from libiancrawlers.common.search import SearchByKeywordContext, SearchByKeywordResult, abstract_search

import async_to_sync


def search(*,
           keywords: Union[str, Tuple[str]],
           search_type: str,
           fetch_all_content: bool = False,
           fetch_all_comment: bool = False,
           retry: int = 0,
           ):
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

    search_sync = async_to_sync.function(search_async)

    def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
        page = c.get('page')
        result = search_sync(
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

    return abstract_search(
        keywords=keywords,
        fetch_all_content=fetch_all_content,
        fetch_all_comment=fetch_all_comment,
        retry=retry,
        platform_id='bilibili',
        crawler_tag='lib_bilibili-api-python',
        on_init=lambda: None,
        on_search_by_keyword=on_search_by_keyword,
        on_retry=lambda: time.sleep(60),
        page_size_ignore=True,
    )


def cli():
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
