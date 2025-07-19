# -*- coding: UTF-8 -*-
import string
import re
import aiofiles
from loguru import logger
from libiancrawlers.app_util.magic_util import parse_json
from libiancrawlers.app_util.types import JSON


async def parse_json_or_read_file_json_like(t: JSON) -> JSON:
    _old_t = t
    if not isinstance(t, str):
        return t
    if t.startswith('lines_file/'):
        fn = t[len('lines_file/'):]
        async with aiofiles.open(fn, mode='rt', encoding='utf-8') as f:
            res = [line.strip() for line in await f.readlines() if len(line.strip()) > 0]
            if len(res) <= 0:
                raise ValueError(f'Empty lines : {t}')
            return res
    if t.startswith('jsonfile:'):
        # old api
        t = t[len('jsonfile:'):]
        t = 'jsonfile/' + t
        logger.warning('please modify "jsonfile:" to "jsonfile/" , t is {} , _old_t is {}', t, _old_t)
    if t.startswith('jsonfile/'):
        try:
            t = t[len('jsonfile/'):]
            from libiancrawlers.app_util.obj2dict_util import url_parse_to_dict
            url_info = url_parse_to_dict(t)
            logger.debug('json file url info is {}', url_info)
            async with aiofiles.open(url_info['path'], 'rt', encoding='utf-8') as f:
                t2 = await f.read()

            def rep_word(_k):
                return f'<<<<!{_k}!>>>>'

            for k in url_info['query_dict']:
                if t2.find(rep_word(k)) < 0:
                    raise KeyError(f"Not found {rep_word(k)} in json file , can't replace it to value !")
                t2 = t2.replace(rep_word(k), url_info['query_dict'][k])

            for _not_spec_param in re.findall('<<<<!(.*)!>>>>', t2):
                raise KeyError(f'Parameters {_not_spec_param} need to be passed in!')

            # t2 = string.Template(t2).substitute(url_info['query_dict'])
            logger.debug('read file json and format result is {}', t2)
            return await parse_json_or_read_file_json_like(t2)
        except BaseException as err:
            raise ValueError(f'Invalid --steps input : {err}') from err
    j, j5 = parse_json(t)
    if j is not None:
        return j
    if j5 is not None:
        return j5
    raise ValueError(f'Invalid json : {t}')


if __name__ == '__main__':
    pass
