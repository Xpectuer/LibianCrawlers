# -*- coding: UTF-8 -*-
import asyncio
from typing import List, Union, Tuple

from aioify import aioify
from loguru import logger

from libiancrawlers.common.postgres import get_conn, close_global_pg_pool
from libiancrawlers.common.search import abstract_search, SearchByKeywordContext, SearchByKeywordResult
from libiancrawlers.xiaohongshu import XHSNoteLink, aioget_global_xhs_client
from ..common import on_before_retry_default, Initiator, exit_app


async def search(*,
                 keywords: Union[str, Tuple[str]],
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

    # """
    #
    #
    # :param keywords: 搜索关键字
    # :param fetch_all_content: 是否爬取正文
    # :param fetch_all_comment: 是否爬取全部评论
    # :param retry: 最大重试次数
    # :return:
    # """
    # if isinstance(keywords, str):
    #     keywords = keywords.split(',')
    #
    # logger.info('Search keywords : {}', keywords)
    #
    # _search_page_max = read_config('crawler', 'xiaohongshu', 'search-page-max')
    # _search_page_size = read_config('crawler', 'xiaohongshu', 'search-page-size')
    #
    # xhs_client = get_global_xhs_client()
    #
    # require_init_table()
    #
    # def _check_no_content_crawling(*, kwd: str):
    #     note_ids = get_note_links_which_no_content_crawling(keyword=kwd, force_all=False)
    #     logger.info("Exist {} note which searched by {} but not crawling content , start crawling...",
    #                 len(note_ids), kwd)
    #     _ban_count = 0
    #     for n in note_ids:
    #         try:
    #             get_note(note_id=n.note_id,
    #                      xsec_token=n.xsec_token,
    #                      fetch_all_comment=fetch_all_comment,
    #                      guess_title=n.title,
    #                      detail_logd=False)
    #             _ban_count = 0
    #         except NoteNotExistOrFengKongException as e:
    #             if _ban_count > 6:
    #                 raise NoteNotExistOrFengKongException('Maybe account be BAN') from e
    #             logger.warning('Note not exist or account be BAN ...')
    #             _ban_count += 1
    #             continue
    #
    # _err_ref = None
    #
    # for retry_count in range(1, max(2, retry + 1)):
    #     try:
    #         for keyword in keywords:
    #             if fetch_all_content:
    #                 _check_no_content_crawling(kwd=keyword)
    #             else:
    #                 logger.debug('Skip crawling content for {} ...', keyword)
    #
    #             for page in range(1, _search_page_max):
    #                 logger.debug('Start search {} page {} (size {}, max {})',
    #                              keyword, page, _search_page_size, _search_page_max)
    #                 result = xhs_client.get_note_by_keyword(keyword, page=page, page_size=_search_page_size)
    #
    #                 insert_to_garbage_table(
    #                     g_type='xiaohongshu_search_result',
    #                     g_content=dict(
    #                         result=result,
    #                         page=page,
    #                         search_page_size=_search_page_size,
    #                         search_page_max=_search_page_max,
    #                     ),
    #                     g_search_key=keyword,
    #                 )
    #
    #                 if not result["has_more"]:
    #                     break
    #
    #         logger.info('Finish search {}', keywords)
    #
    #         for keyword in keywords:
    #             if fetch_all_content:
    #                 _check_no_content_crawling(kwd=keyword)
    #             else:
    #                 logger.debug('Skip crawling content for {} ...', keyword)
    #
    #         logger.info('Success !')
    #         return
    #     except BaseException as e:
    #         _err_ref = e
    #         logger.exception('Failed , current retry {}/{}', retry_count, retry)
    #         if retry_count < retry:
    #             time.sleep(60)
    #         continue
    # raise _err_ref


# def get_note_links_which_no_content_crawling(*, keyword: str, force_all: bool) -> List[XHSNoteLink]:
#     conn = get_conn()
#     try:
#         cur = conn.cursor()
#         cur.execute(f"""
# SELECT
# f.id,
# f.xsec_token,
# f.a_title
# FROM libian_crawler.xiaohongshu_notes_full as f
# WHERE g_type = 'xiaohongshu_search_result'
# and g_search_key = %s
# and ( %s or ( not COALESCE(note2_exist, false) ) )
# """, (keyword, force_all))
#         records = cur.fetchall()
#         logger.debug('success get note links , records length is', len(records))
#         conn.commit()
#         return list(map(lambda it: XHSNoteLink(it[0], it[1], it[2]), records))
#     finally:
#         conn.close()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    from libiancrawlers.common import init_app
    init_app(Initiator(postgres=True, playwright=False))
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
