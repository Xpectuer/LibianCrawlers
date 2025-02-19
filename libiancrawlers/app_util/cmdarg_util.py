# -*- coding: UTF-8 -*-
import aiofiles

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
            p = t[len('jsonfile:'):]
            async with aiofiles.open(p, 'rt') as f:
                t2 = await f.read()
            return await parse_json_or_read_file_json_like(t2)
        except BaseException as err:
            raise ValueError('Invalid json file') from err
    raise ValueError(f'Invalid json : {t}')


if __name__ == '__main__':
    pass
