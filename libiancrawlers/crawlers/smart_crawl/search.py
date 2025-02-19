# -*- coding: UTF-8 -*-
import asyncio
import multiprocessing
from typing import Union, Tuple, Optional, Literal
from loguru import logger

from libiancrawlers.app_util.types import Initiator
from libiancrawlers.app_util.app_init import exit_app, init_app
from libiancrawlers.app_util.search import SearchByKeywordContext, SearchByKeywordResult

_all_tasks = ['taobao']


# async def search(*,
#                  keywords: Union[str, Tuple[str]],
#                  page_max: Optional[int] = None,
#                  platform: Literal['all'] = 'all',
#                  retry: int = 0,
#                  _shutdown_app=True,
#                  ):
#     if platform == 'all':
#         platform = _all_tasks
#     if isinstance(platform, str):
#         platform = platform.split(',')
#
#     logger.debug('search platform were {}', platform)
#
#     def get_search_task(plat: str):
#         if plat in _all_tasks:
#             return _task_of_platform(plat=plat, retry=retry, keywords=keywords, page_max=page_max)
#         else:
#             logger.error('Invalid platform value : {}', plat)
#
#     search_tasks = list(map(lambda plat: get_search_task(plat), platform))
#
#     try:
#         await asyncio.gather(*search_tasks)
#     finally:
#         if _shutdown_app:
#             await exit_app()

#
# async def _task_of_platform(*, plat, retry, keywords, page_max):
#     from libiancrawlers.app_util.crawlers_util import on_before_retry_default
#     from libiancrawlers.app_util.search import abstract_search
#
#     if plat == 'taobao':
#         on_init, on_search_by_keyword = None, None  # _get_ctx_taobao()
#     else:
#         raise ValueError(f'Invalid plat {plat}')
#
#     await abstract_search(
#         keywords=keywords,
#         page_max=page_max,
#         page_size=None,
#         fetch_all_content=False,
#         fetch_all_comment=False,
#         retry_max=retry,
#         platform_id=f'{plat}',
#         crawler_tag='smart_crawl_search',
#         on_init=on_init,
#         on_search_by_keyword=on_search_by_keyword,
#         on_before_retry=on_before_retry_default,
#         page_size_ignore=True,
#     )


# def _get_ctx_taobao():
#     async def _on_init():
#         logger.debug('start task init of taobao')
#         await smart_crawl_v1_api(url='https://www.taobao.com/',
#                                  browser_data_dir_id_suffix='smart_crawl_taobao',
#                                  tag_group='smart_crawl_taobao_search',
#                                  tag_version='dev_v1',
#                                  locale='zh-CN')
#
#     async def _on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
#         # page = c.get('page')
#         # result = await search_async(
#         #     keyword=c.get('keyword'),
#         #     page=page,
#         # )
#
#         return {
#             'search_result': {
#                 "html_tree": None  # result,
#             },
#             'has_more': False  # result.get('numPages', 1) > page
#         }
#
#     return _on_init, _on_search_by_keyword


def cli():
    init_app(Initiator(postgres=True, playwright=False))
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
