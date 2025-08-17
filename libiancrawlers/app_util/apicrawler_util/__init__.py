# -*- coding: UTF-8 -*-
import asyncio
import datetime
import json
import os
import re
from typing import Any

import aiofiles
from loguru import logger

from libiancrawlers.app_util.postgres import insert_to_garbage_table
from libiancrawlers.app_util.types import JSON
from libiancrawlers.util.fs import mkdirs, filename_slugify


async def on_before_retry_default(retry_count: int) -> bool:
    if retry_count < 3:
        await asyncio.sleep(30)
        return True
    else:
        return False


def log_debug_which_object_maybe_very_length(*, prefix: str, obj: Any, max_output_length: int, ret_str: bool = False):
    """
    https://stackoverflow.com/a/2718203
    """
    out = f'{prefix} ; class {type(obj)}'
    if isinstance(obj, str):
        text = obj
        out += f' str len {len(obj)}'
    else:
        try:
            text = json.dumps(obj, ensure_ascii=False)
        except BaseException:
            text = str(obj)
            out += ' (can not parse json)'
        try:
            out += f' len {len(obj)}'
        except BaseException:
            out += ' (can not get length)'

    out += ' ; CJK char >>> '
    for n in re.findall(r'[\u4e00-\u9fff]+', text):
        out += n
        if len(out) > max_output_length:
            break
    if len(out) > max_output_length:
        out = out[0:max_output_length] + '...'
    if not ret_str:
        logger.debug(out)
        return None
    else:
        return out


async def dump_data(*, _output: JSON, is_insert_to_db: bool, is_save_file: bool, output_dir: str):
    if is_insert_to_db:
        await insert_to_garbage_table(**_output)
    if is_save_file:
        await mkdirs(output_dir)
        result_file_path = os.path.join(
            output_dir,
            f'{filename_slugify(int(datetime.datetime.utcnow().timestamp() * 1000), allow_unicode=True)}.json'
        )
        async with aiofiles.open(
                result_file_path,
                mode='wt',
                encoding='utf-8') as f:
            await f.write(json.dumps(_output, ensure_ascii=False, indent=2))
            logger.debug('result file :\n    {}\n', result_file_path)


if __name__ == '__main__':
    pass
