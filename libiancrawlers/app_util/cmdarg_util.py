# -*- coding: UTF-8 -*-
import string

import aiofiles
from loguru import logger
from libiancrawlers.app_util.magic_util import parse_json
from libiancrawlers.app_util.types import JSON


async def parse_json_or_read_file_json_like(t: JSON) -> JSON:
    if not isinstance(t, str):
        return t
    j, j5 = parse_json(t)
    if j is not None:
        return j
    if j5 is not None:
        return j5
    if t.startswith('jsonfile:'):
        try:
            from libiancrawlers.app_util.playwright_util import url_parse_to_dict
            url_info = url_parse_to_dict(t)
            logger.debug('json file url info is {}', url_info)
            async with aiofiles.open(url_info['path'], 'rt') as f:
                t2 = await f.read()
            t2 = string.Template(t2).substitute(url_info['query_dict'])
            logger.debug('read file json and format result is {}', t2)
            return await parse_json_or_read_file_json_like(t2)
        except BaseException as err:
            raise ValueError('Invalid json file , or Missing format argument') from err
    raise ValueError(f'Invalid json : {t}')


if __name__ == '__main__':
    pass
