# -*- coding: UTF-8 -*-
import time
from os import PathLike
from typing import List, Optional, Union, Tuple, Literal, NamedTuple
from loguru import logger

from libiancrawlers.common.postgres import insert_to_garbage_table, require_init_table, get_conn
from libiancrawlers.xiaohongshu import create_xhs_client, get_global_xhs_client, XHSNoteLink, concat_xhs_note_url, \
    NoteNotExistOrFengKongException
from libiancrawlers.xiaohongshu.get_note import get_note
from ..common import read_config, isinstance_tls


def search(*,
           keywords: Union[str, Tuple[str]],
           fetch_all_content: bool = False,
           fetch_all_comment: bool = False,
           retry: int = 0,
           ):
    """


    :param keywords: 搜索关键字
    :param fetch_all_content: 是否爬取正文
    :param fetch_all_comment: 是否爬取全部评论
    :param retry: 最大重试次数
    :return:
    """
    if isinstance(keywords, str):
        keywords = keywords.split(',')

    logger.info('Search keywords : {}', keywords)

    _search_page_max = read_config('crawler', 'xiaohongshu', 'search-page-max')
    _search_page_size = read_config('crawler', 'xiaohongshu', 'search-page-size')

    xhs_client = get_global_xhs_client()

    require_init_table()

    def _check_no_content_crawling(*, kwd: str):
        note_ids = get_note_links_which_no_content_crawling(keyword=kwd, force_all=False)
        logger.info("Exist {} note which searched by {} but not crawling content , start crawling...",
                    len(note_ids), kwd)
        _ban_count = 0
        for n in note_ids:
            try:
                get_note(note_id=n.note_id,
                         xsec_token=n.xsec_token,
                         fetch_all_comment=fetch_all_comment,
                         guess_title=n.title,
                         detail_logd=False)
                _ban_count = 0
            except NoteNotExistOrFengKongException as e:
                if _ban_count > 6:
                    raise NoteNotExistOrFengKongException('Maybe account be BAN') from e
                logger.warning('Note not exist or account be BAN ...')
                _ban_count += 1
                continue

    _err_ref = None

    for retry_count in range(1, max(2, retry + 1)):
        try:
            for keyword in keywords:
                if fetch_all_content:
                    _check_no_content_crawling(kwd=keyword)
                else:
                    logger.debug('Skip crawling content for {} ...', keyword)

                for page in range(1, _search_page_max):
                    logger.debug('Start search {} page {} (size {}, max {})',
                                 keyword, page, _search_page_size, _search_page_max)
                    result = xhs_client.get_note_by_keyword(keyword, page=page, page_size=_search_page_size)

                    insert_to_garbage_table(
                        g_type='xiaohongshu_search_result',
                        g_content=dict(
                            result=result,
                            page=page,
                            search_page_size=_search_page_size,
                            search_page_max=_search_page_max,
                        ),
                        g_search_key=keyword,
                    )

                    if not result["has_more"]:
                        break

            logger.info('Finish search {}', keywords)

            for keyword in keywords:
                if fetch_all_content:
                    _check_no_content_crawling(kwd=keyword)
                else:
                    logger.debug('Skip crawling content for {} ...', keyword)

            logger.info('Success !')
            return
        except BaseException as e:
            _err_ref = e
            logger.exception('Failed , current retry {}/{}', retry_count, retry)
            if retry_count < retry:
                time.sleep(60)
            continue
    raise _err_ref


def get_note_links_which_no_content_crawling(*, keyword: str, force_all: bool) -> List[XHSNoteLink]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
SELECT
f.id,
f.xsec_token,
f.a_title
FROM libian_crawler.xiaohongshu_notes_full as f
WHERE g_type = 'xiaohongshu_search_result' 
and g_search_key = %s
and ( %s or ( not COALESCE(note2_exist, false) ) )
""", (keyword, force_all))
        records = cur.fetchall()
        logger.debug('success get note links , records length is', len(records))
        conn.commit()
        return list(map(lambda it: XHSNoteLink(it[0], it[1], it[2]), records))
    finally:
        conn.close()


def cli():
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
