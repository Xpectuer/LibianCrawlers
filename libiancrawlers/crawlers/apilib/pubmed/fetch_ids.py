# -*- coding: UTF-8 -*-
import asyncio
import os
from typing import Union, Tuple, Optional
from urllib.parse import urlparse

import aiohttp
from loguru import logger

from libiancrawlers.app_util.apicrawler_util import dump_data
from libiancrawlers.app_util.app_init import init_app
from libiancrawlers.app_util.magic_util import get_magic_info
from libiancrawlers.app_util.obj2dict_util import url_parse_to_dict, aiohttp_resp_to_dict
from libiancrawlers.app_util.types import Initiator
from libiancrawlers.crawlers import the_default_crawl_mode__save_file, CrawlMode, parse_mode


def fetch_ids(*,
              mode: CrawlMode = the_default_crawl_mode__save_file,
              data: str,
              output_dir: Optional[str] = None,
              ):
    is_save_file, is_insert_to_db = parse_mode(mode)

    init_app(Initiator(postgres=is_insert_to_db, playwright=False))

    loop = asyncio.get_event_loop()

    if output_dir is None:
        output_dir = os.path.join('.data', 'apilib', 'pubmed', 'fetch_ids')

    async def _fetch_rows():
        from libiancrawlers.app_util.cmdarg_util import parse_json_or_read_file_json_like
        lines = await parse_json_or_read_file_json_like(data)

        def parse_int(l: str):
            try:
                _line_int = int(l)
            except ValueError:
                _line_int = None
            return _line_int

        def parse_url(l: str):
            try:
                u = urlparse(l)
                if u is None:
                    return None
            except BaseException:
                return None
            if u.hostname != 'pubmed.ncbi.nlm.nih.gov':
                return None
            paths = list(filter(lambda it: len(it) > 0, u.path.split('/')))
            if paths.__len__() <= 0:
                return None
            pid = parse_int(paths[0])
            return pid

        line_count = 0
        for line in lines:
            line_count += 1
            for pubmed_id in [parse_int(line), parse_url(line)]:
                if pubmed_id is None:
                    continue
                else:
                    break
            if pubmed_id is None:
                logger.warning('Not found pubmed_id in line {} : {}', line_count, line)
                continue
            logger.debug('Found pubmed_id is {} , line {} is {}', pubmed_id, line_count, line)
            req_url = f'https://pubmed.ncbi.nlm.nih.gov/{pubmed_id}/?format=pubmed'
            async with aiohttp.request('GET', req_url) as resp:
                _body = await resp.read()
                if not resp.ok:
                    logger.error('Failed to found pubmed_id {} , resp is {}',
                                 pubmed_id, aiohttp_resp_to_dict(resp))
                else:
                    logger.debug('Success found pubmed_id {}', pubmed_id)
                    _output = dict(
                        g_type=f'pubmed_fetch_ids',
                        g_content=dict(
                            result=dict(
                                line=line,
                                line_count=line_count,
                                pubmed_id=pubmed_id,
                                request_url=url_parse_to_dict(req_url),
                                resp=aiohttp_resp_to_dict(resp),
                                body=get_magic_info(_body,
                                                    dump_page_ignore_names=None,
                                                    html2markdown_soup_find=None),
                            ),
                            platform_id='pubmed',
                            crawler_tag='fetch_ids',
                        ),
                        g_search_key=None,
                    )
                    await dump_data(
                        _output=_output,
                        is_insert_to_db=is_insert_to_db,
                        is_save_file=is_save_file,
                        output_dir=output_dir
                    )

    loop.run_until_complete(_fetch_rows())


_SHUTDOWN_AFTER_FETCH_IDS = False


def cli():
    global _SHUTDOWN_AFTER_FETCH_IDS
    _SHUTDOWN_AFTER_FETCH_IDS = True
    from fire import Fire
    Fire(fetch_ids)


if __name__ == '__main__':
    pass
