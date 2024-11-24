# -*- coding: UTF-8 -*-
from typing import Union, Tuple, Callable, TypedDict, Optional, Awaitable

from loguru import logger

from libiancrawlers.common.config import read_config
from libiancrawlers.common.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.common.types import JSON


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
                          keywords: Union[str, Tuple[str]],
                          fetch_all_content: bool = False,
                          fetch_all_comment: bool = False,
                          retry_max: int = 0,
                          platform_id: str,
                          crawler_tag: JSON,
                          on_init: Callable[[], Awaitable[None]],
                          # on_get_content: Callable[[], None],
                          on_search_by_keyword: Callable[[SearchByKeywordContext], Awaitable[SearchByKeywordResult]],
                          on_before_retry: Callable[[int], Awaitable[bool]],
                          page_size_ignore=False,
                          ):
    if isinstance(keywords, str):
        keywords = keywords.split(',')

    logger.info('Search keywords : {}', keywords)

    page_max = read_config('crawler', 'platform', platform_id, 'search-page-max',
                           checking=lambda it: 'Require >= 1' if it is None or it < 1 else None)
    if not page_size_ignore:
        page_size = read_config('crawler', 'platform', platform_id, 'search-page-size',
                                checking=lambda it: 'Require >= 1' if it is None or it < 1 else None)
    else:
        page_size = None

    await on_init()

    await require_init_table()

    def _check_no_content_crawling(*, kwd: str):
        pass
        # note_ids = get_note_links_which_no_content_crawling(keyword=kwd, force_all=False)
        # logger.info("Exist {} note which searched by {} but not crawling content , start crawling...",
        #             len(note_ids), kwd)
        # _unknown_reason_continuous_failed_counter = 0
        # for n in []:
        #     try:
        #         on_get_content()
        #         # get_note(note_id=n.note_id,
        #         #          xsec_token=n.xsec_token,
        #         #          fetch_all_comment=fetch_all_comment,
        #         #          guess_title=n.title,
        #         #          detail_logd=False)
        #         _unknown_reason_continuous_failed_counter = 0
        #     except UnknownReasonContinuousFailed as e:
        #         if _unknown_reason_continuous_failed_counter > 6:
        #             raise UnknownReasonContinuousFailed('Maybe account be BAN') from e
        #         _unknown_reason_continuous_failed_counter += 1
        #         logger.warning('Fetch content failed , unknown reason , counter = {} ...',
        #                        _unknown_reason_continuous_failed_counter)
        #         continue

    _err_ref = None

    for retry_count in range(1, max(2, retry_max + 1)):
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

                    await insert_to_garbage_table(
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

                    if not res.get('has_more'):
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
