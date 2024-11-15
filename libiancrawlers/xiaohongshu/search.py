# -*- coding: UTF-8 -*-
from os import PathLike
from typing import List, Optional
from loguru import logger

from libiancrawlers.xiaohongshu import create_xhs_client
from ..common import read_config


def search(*, keywords: List[str]):
    config = read_config()
    logger.debug('Start search : {}', keywords)
    xhs_client = create_xhs_client(cookie=config['crawler']['xiaohongshu']['cookie'])
    for keyword in keywords:
        search_result = xhs_client.get_note_by_keyword(keyword, page=1, page_size=20)
        logger.debug('Search result : {}', search_result)


def cli():
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
