# -*- coding: UTF-8 -*-
import asyncio
import json
import os
import re
from datetime import datetime
from typing import Callable, Optional, Awaitable, Any

import unicodedata
from aiofiles import os as aioos
from aioify import aioify
from loguru import logger

from libiancrawlers.common.playwright_util import shutdown_playwright
from libiancrawlers.common.types import Initiator

aios = aioify(obj=os, name='aios')


def is_windows():
    return os.name == 'nt'


async def on_before_retry_default():
    await asyncio.sleep(60)


async def sleep(total: float, *, interval: float = 3, checker: Optional[Callable[[], Awaitable[bool]]] = None):
    start = datetime.utcnow().timestamp()
    end = start + total
    now = start
    while now < end:
        if checker is not None:
            if not await checker():
                return False
        now = datetime.utcnow().timestamp()
        await asyncio.sleep(min(interval, end - now))
        now = datetime.utcnow().timestamp()
    return True


async def mkdirs(dir_name: str, *, mode=700, exist_ok=True):
    if await aioos.path.exists(dir_name):
        if not await aioos.path.isdir(dir_name):
            logger.warning('Mkdirs points to existed file : {}', dir_name)
    else:
        logger.debug('mkdirs at {}', dir_name)
    await aioos.makedirs(dir_name, mode=mode, exist_ok=exist_ok)
    return dir_name


def log_debug_which_object_maybe_very_length(*, prefix: str, obj: Any, max_output_length: int):
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
    logger.debug(out)


def filename_slugify(value, *, allow_unicode: bool):
    """
    Taken from https://github.com/django/django/blob/master/django/utils/text.py
    Convert to ASCII if 'allow_unicode' is False. Convert spaces or repeated
    dashes to single dashes. Remove characters that aren't alphanumerics,
    underscores, or hyphens. Convert to lowercase. Also strip leading and
    trailing whitespace, dashes, and underscores.
    """
    value = str(value)
    if allow_unicode:
        value = unicodedata.normalize('NFKC', value)
    else:
        value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value.lower())
    return re.sub(r'[-\s]+', '-', value).strip('-_')


if __name__ == '__main__':
    pass
