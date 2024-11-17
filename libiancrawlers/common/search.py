# -*- coding: UTF-8 -*-
from typing import Union, Tuple, Callable, TypedDict

from loguru import logger

from libiancrawlers.common import read_config
from libiancrawlers.common.postgres import require_init_table, insert_to_garbage_table
from libiancrawlers.common.types import JSON


class UnknownReasonContinuousFailed(Exception):
    pass


SearchByKeywordContext = TypedDict('SearchByKeywordContext', {
    'keyword': str,
    'page': int,
    'page_size': int,
})
SearchByKeywordResult = TypedDict('SearchByKeywordResult', {
    'search_result': JSON,
    'has_more': bool,
})


def abstract_search(*,
                    keywords: Union[str, Tuple[str]],
                    fetch_all_content: bool = False,
                    fetch_all_comment: bool = False,
                    retry: int = 0,
                    platform_id: str,
                    on_init: Callable[[], None],
                    # on_get_content: Callable[[], None],
                    on_search_by_keyword: Callable[[SearchByKeywordContext], SearchByKeywordResult],
                    on_retry: Callable[[], None],
                    max_unknown_reason_failed: int = 6,
                    ):
    if isinstance(keywords, str):
        keywords = keywords.split(',')

    logger.info('Search keywords : {}', keywords)

    page_max = read_config('crawler', platform_id, 'search-page-max',
                           checking=lambda it: 'Require >= 1' if it is None or it < 1 else None)

    page_size = read_config('crawler', platform_id, 'search-page-size',
                            checking=lambda it: 'Require >= 1' if it is None or it < 1 else None)

    on_init()
    # xhs_client = get_global_xhs_client()

    require_init_table()

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

    for retry_count in range(1, max(2, retry + 1)):
        try:
            for keyword in keywords:
                if fetch_all_content:
                    _check_no_content_crawling(kwd=keyword)
                else:
                    logger.debug('Skip crawling content for {} from {} ...', keyword, platform_id)

                for page in range(1, page_max):
                    logger.debug('Start search {} page {} (size {}, max {}, platform {})',
                                 keyword, page, page_size, page_max, platform_id)

                    res = on_search_by_keyword({
                        'keyword': keyword,
                        'page': page,
                        'page_size': page_size,
                    })

                    insert_to_garbage_table(
                        g_type=f'{platform_id}_search_result',
                        g_content=dict(
                            result=res.get('search_result'),
                            platform_id=platform_id,
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
            logger.exception('Failed crawling on {}, current keywords are {}, current retry {}/{}',
                             platform_id, keywords, retry_count, retry)
            if retry_count < retry:
                on_retry()
            continue
    raise _err_ref


if __name__ == '__main__':
    pass
