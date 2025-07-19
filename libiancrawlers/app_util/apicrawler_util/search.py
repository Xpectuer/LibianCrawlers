# -*- coding: UTF-8 -*-
import datetime
import json
import os
from typing import Union, Tuple, Callable, TypedDict, Optional, Awaitable, Literal

import aiofiles.os
from loguru import logger

from libiancrawlers.app_util.config import read_config
from libiancrawlers.app_util.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.app_util.types import JSON
from libiancrawlers.crawlers import CrawlMode, parse_mode
from libiancrawlers.util.fs import filename_slugify, mkdirs


class UnknownReasonContinuousFailed(Exception):
    pass


SearchByKeywordContext = TypedDict('SearchByKeywordContext', {
    'keyword': str,
    'page': int,
    'page_size': Optional[int],
})
SearchByKeywordResult = TypedDict('SearchByKeywordResult', {
    'search_result': JSON,
    'has_more': bool,
})


async def abstract_search(*,
                          mode: CrawlMode,
                          output_dir: Optional[str],
                          keywords: Union[str, Tuple[str]],
                          page_max: Optional[int],
                          page_size: Optional[int],
                          page_size_ignore=False,
                          fetch_all_content: bool,
                          fetch_all_comment: bool,
                          retry_max: int,
                          platform_id: str,
                          crawler_tag: JSON,
                          on_init: Callable[[], Awaitable[None]],
                          # on_get_content: Callable[[], None],
                          on_search_by_keyword: Callable[[SearchByKeywordContext], Awaitable[SearchByKeywordResult]],
                          on_before_retry: Callable[[int], Awaitable[bool]],
                          ):
    from libiancrawlers.app_util.apicrawler_util import log_debug_which_object_maybe_very_length

    is_save_file, is_insert_to_db = parse_mode(mode)

    if output_dir is None:
        output_dir = os.path.join('.data', 'apilib', filename_slugify(platform_id, allow_unicode=True), 'search')

    if isinstance(keywords, str):
        keywords = keywords.split(',')

    logger.info('Search keywords : {}', keywords)

    page_max = page_max if page_max is not None \
        else await read_config('crawler', 'platform', platform_id, 'search-page-max',
                               allow_null=True,
                               checking_sync=lambda it: 'Require >= 1' if it is not None and it < 1 else None)
    if page_max is None:
        page_max = 10

    if not page_size_ignore:
        page_size = page_size if page_size is not None \
            else await read_config('crawler', 'platform', platform_id, 'search-page-size',
                                   allow_null=True,
                                   checking_sync=lambda it: 'Require >= 1' if it is not None and it < 1 else None)
        if page_size is None:
            page_size = 20
    else:
        page_size = None

    if is_insert_to_db:
        await require_init_table()

    await on_init()

    def _check_no_content_crawling(*, kwd: str):
        pass

    _err_ref = None

    for retry_count in range(1, max(2, retry_max + 1)):
        logger.debug('Start crawling from search , retry_count = {}', retry_count)
        try:
            for keyword in keywords:
                if fetch_all_content:
                    _check_no_content_crawling(kwd=keyword)
                else:
                    logger.debug('Skip crawling content for {} from {} ...', keyword, platform_id)

                for page in range(1, page_max + 1):
                    logger.debug('Start search {} page {} (size {}, max {}, platform {})',
                                 keyword, page, page_size, page_max, platform_id)

                    res = await on_search_by_keyword({
                        'keyword': keyword,
                        'page': page,
                        'page_size': page_size,
                    })

                    log_debug_which_object_maybe_very_length(prefix='Result of on_search_by_keyword',
                                                             obj=res,
                                                             max_output_length=200)

                    _output = dict(
                        g_type=f'{platform_id}_search_result',
                        g_content=dict(
                            result=res.get('search_result'),
                            platform_id=platform_id,
                            crawler_tag=crawler_tag,
                            page=page,
                            search_page_size=page_size,
                            search_page_max=page_max,
                        ),
                        g_search_key=keyword,
                    )
                    if is_insert_to_db:
                        await insert_to_garbage_table(**_output)
                    if is_save_file:
                        await mkdirs(output_dir)
                        result_file_path = os.path.join(
                            output_dir,
                            f'{filename_slugify(int(datetime.datetime.utcnow().timestamp() * 1000), allow_unicode=True)}.json'
                        )
                        async with aiofiles.open(
                                result_file_path,
                                mode='wt',
                                encoding='utf-8') as f:
                            await f.write(json.dumps(_output, ensure_ascii=False, indent=2))
                            logger.debug('result file :\n    {}\n', result_file_path)

                    if not res.get('has_more'):
                        logger.debug('continue to fetch page because has_more = {}', res.get('has_more'))
                        break

            logger.info('Finish search {} from {}', keywords, platform_id)

            for keyword in keywords:
                if fetch_all_content:
                    _check_no_content_crawling(kwd=keyword)
                else:
                    logger.debug('Skip crawling content for {} from {} ...', keyword, platform_id)

            logger.info('Success for crawling {} from {} !', keywords, platform_id)
            return
        except BaseException as e:
            _err_ref = e
            logger.exception('Failed crawling on {}, current keywords are {}, current retry_max {}/{}',
                             platform_id, keywords, retry_count, retry_max)
            if retry_count < retry_max and await on_before_retry(retry_count):
                logger.info('Start retry , retry_count={}, retry_max={}', retry_count, retry_max)
                continue
            else:
                logger.info('Break retry loop on retry_count={}, retry_max={}', retry_count, retry_max)
    raise _err_ref


if __name__ == '__main__':
    pass
