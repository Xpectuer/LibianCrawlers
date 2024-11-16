# -*- coding: UTF-8 -*-
from os import PathLike
from typing import List, Optional, Union, Tuple
from loguru import logger

from libiancrawlers.common.postgres import insert_to_garbage_table, require_init_table
from libiancrawlers.xiaohongshu import create_xhs_client
from ..common import read_config, isinstance_tls


def search(*, keywords: Union[str, Tuple[str]]):
    if not isinstance_tls(keywords):
        keywords = [keywords]
    _cookie = read_config('crawler', 'xiaohongshu', 'cookie')
    _search_page_max = read_config('crawler', 'xiaohongshu', 'search-page-max')
    _search_page_size = read_config('crawler', 'xiaohongshu', 'search-page-size')

    xhs_client = create_xhs_client(cookie=_cookie)
    # table = get_nocodb_table(
    #     title='crawler-xiaohongshu-search-result',
    #     cols=dict(
    #         keyword=Column.DataType.SingleLineText,
    #         page=Column.DataType.Number,
    #         page_size=Column.DataType.Number,
    #         result=Column.DataType.JSON,
    #         cookie=Column.DataType.SingleLineText,
    #     )
    # )
    require_init_table()

    for keyword in keywords:
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

            # break

            if not result["has_more"]:
                break
    logger.info('Finish search {}', keywords)


def cli():
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
