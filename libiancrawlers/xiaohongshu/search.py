# -*- coding: UTF-8 -*-
from typing import Union, Tuple, Optional

from aioify import aioify

from libiancrawlers.common import on_before_retry_default, Initiator
from libiancrawlers.common.app_init import exit_app, init_app
from libiancrawlers.common.search import abstract_search, SearchByKeywordContext, SearchByKeywordResult
from libiancrawlers.xiaohongshu import aioget_global_xhs_client


async def search(*,
                 keywords: Union[str, Tuple[str]],
                 page_max: Optional[int] = None,
                 page_size: Optional[int] = None,
                 fetch_all_content: bool = False,
                 fetch_all_comment: bool = False,
                 retry_max: int = 0,
                 ):
    try:
        xhs_client = await aioget_global_xhs_client()

        async def on_init():
            pass

        def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
            result = xhs_client.get_note_by_keyword(
                keyword=c.get('keyword'),
                page=c.get('page'),
                page_size=c.get('page_size'))
            return {
                'search_result': result,
                'has_more': result.get('has_more', False)
            }

        # noinspection SpellCheckingInspection
        aioon_search_by_keyword = aioify(on_search_by_keyword)

        await abstract_search(
            keywords=keywords,
            page_max=page_max,
            page_size=page_size,
            fetch_all_content=fetch_all_content,
            fetch_all_comment=fetch_all_comment,
            retry_max=retry_max,
            platform_id='xiaohongshu',
            crawler_tag='lib_xhs',
            on_init=on_init,
            on_search_by_keyword=aioon_search_by_keyword,
            on_before_retry=on_before_retry_default,
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
