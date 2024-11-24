# -*- coding: UTF-8 -*-
import asyncio
import atexit
import sys
from typing import Optional

from loguru import logger

from libiancrawlers.common.types import Initiator

_APP_INIT_CONF: Optional[Initiator] = None


def get_app_init_conf():
    return _APP_INIT_CONF


def init_app(conf: Initiator):
    from libiancrawlers.common import is_windows

    global _APP_INIT_CONF
    if _APP_INIT_CONF is not None:
        logger.error("Don't re call init_app , current init conf is {} , but this conf is {}",
                     _APP_INIT_CONF, conf)
        raise Exception('re call init app !')
    logger.debug('init app {}', conf)
    _APP_INIT_CONF = conf
    logger.debug('init asyncio')
    if sys.version_info >= (3, 8) and is_windows():
        if conf.postgres and not conf.playwright:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    logger.debug('current event loop policy {}', asyncio.get_event_loop_policy())
    asyncio.set_event_loop(asyncio.new_event_loop())
    logger.debug('current event loop {}', asyncio.get_event_loop())


# noinspection PyBroadException
async def exit_app():
    from libiancrawlers.common import is_windows
    from libiancrawlers.common.postgres import close_global_pg_pool

    if _APP_INIT_CONF is None:
        raise ValueError('require call init_app before exit !')

    async def close_pg():
        if not _APP_INIT_CONF.postgres:
            return
        # noinspection PyBroadException
        try:
            await close_global_pg_pool()
        except BaseException:
            logger.exception('Failed on close pg pool')
        if is_windows() and isinstance(asyncio.get_event_loop_policy(), asyncio.WindowsProactorEventLoopPolicy):
            atexit.register(lambda: logger.info("""
在 postgres pool 退出时的 `NotImplementedError` 报错 是由以下尚未解决的issue引起，我无法修复它。

> 因为 asyncio 的两种 Windows* event group 都会引发错误。
> 但是无所谓，可以无视此错误。

- https://github.com/aio-libs/aiopg/issues/678#issuecomment-667908402
- https://github.com/scrapy-plugins/scrapy-playwright/issues/7
"""))

    async def close_playwright():
        if not _APP_INIT_CONF.playwright:
            return
        # noinspection PyBroadException
        try:
            from libiancrawlers.common import shutdown_playwright
            await shutdown_playwright()
        except BaseException:
            logger.exception('Failed on close playwright')

    await asyncio.gather(*[
        close_pg(),
        close_playwright()
    ])


if __name__ == '__main__':
    pass
