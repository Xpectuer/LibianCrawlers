# -*- coding: UTF-8 -*-
import asyncio
import atexit
import json
import os
import sys
from typing import Callable, Optional, Any, Awaitable

from confection import Config
from loguru import logger

import aiofiles.os as aioos

from libiancrawlers.common.playwright_util import shutdown_playwright
from libiancrawlers.common.types import Initiator
from datetime import datetime

_APP_INIT_CONF: Optional[Initiator] = None


def is_windows():
    return os.name == 'nt'


def get_app_init_conf():
    return _APP_INIT_CONF


def init_app(conf: Initiator):
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
            await shutdown_playwright()
        except BaseException:
            logger.exception('Failed on close playwright')

    await asyncio.gather(*[
        close_pg(),
        close_playwright()
    ])


CONFIG_VERSION = 1
CONFIG_TEMPLATE = """
[crawler]

[crawler.database]


[crawler.xiaohongshu]
cookie=

"""


def is_config_truthy(s: Optional[str]):
    y = (s.lower() == 'true'
         or s == 1 or s == '1'
         or s.lower() == 'yes'
         or s.lower() == 'y')
    n = (s.lower() == 'false'
         or s == 0 or s == '0'
         or s.lower() == 'no'
         or s.lower() == 'n')
    if not y and not n:
        raise ValueError('Invalid config boolean %s' % s)
    return y


_READIED_CONFIG = None


def read_config(*args: str,
                sys_exit: Optional[Callable[[int], None]] = None,
                checking: Callable[[Any], Optional[str]] = None):
    """
    绝大多数情况下，此函数只在第一次启动时阻塞协程一次。所以无须在意。

    :param args:
    :param sys_exit:
    :param checking:
    :return:
    """
    global _READIED_CONFIG
    if _READIED_CONFIG is None:
        _READIED_CONFIG = _read_config(sys_exit=sys_exit)
    o = _READIED_CONFIG
    arg = None
    try:
        for arg in args:
            o = o[arg]
        err_msg = checking(o) if checking is not None else None
        if err_msg:
            raise ValueError('Invalid config %s : %s' % (args, err_msg))
        return o
    except BaseException:
        logger.error('Error on read config : config is {}',
                     json.dumps(_READIED_CONFIG, ensure_ascii=False, indent=2))
        logger.exception('Failed read config path {} , current : arg={} , o={}',
                         args, arg, json.dumps(o, ensure_ascii=False, indent=2))
        raise


def _read_config(*, sys_exit: Optional[Callable[[int], None]] = None):
    if sys_exit is None:
        sys_exit = sys.exit
    config_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'config')
    if not os.path.exists(config_dir) or not os.path.isdir(config_dir):
        os.makedirs(config_dir, mode=755, exist_ok=True)
    config_file_path = os.path.join(config_dir, 'v1.cfg')
    if not os.path.exists(config_file_path):
        with open(config_file_path, mode='w+', encoding='utf-8') as f:
            logger.warning('Not exist config dir , auto create it at {}', config_file_path)
            f.write(CONFIG_TEMPLATE)
            logger.warning('Please rewrite it !')
        return sys_exit(66)
    logger.debug('Start read config from {}', config_dir)
    # noinspection PyBroadException
    try:
        config = Config().from_disk(config_file_path)
    except BaseException:
        logger.exception('Error on read config file at {}', config_file_path)
        print('Please open the config dir and delete/modify the file:\n\t' + config_file_path)
        return sys_exit(1)
    logger.debug('Config is {}', json.dumps(config, indent=2, ensure_ascii=False))
    return config


async def read_config_get_path(*args: str, create_if_not_exist: bool = False):
    def get_path():
        v: str = read_config(*args, checking=lambda it: None if isinstance(it, str) else 'Should be str')
        p = v.replace('{{HOME}}', os.path.expanduser('~')).replace('/', os.sep)
        logger.debug('get path from config : args={} , v={} , p={}', args, v, p)
        return p

    pth = await asyncio.get_event_loop().run_in_executor(None, get_path)
    if create_if_not_exist and not await aioos.path.exists(pth):
        logger.debug('makedirs {}', pth)
        await aioos.makedirs(pth, mode=755)

    return pth


def random_user_agent():
    from random_user_agent.user_agent import UserAgent
    from random_user_agent.params import SoftwareName, OperatingSystem

    # you can also import SoftwareEngine, HardwareType, SoftwareType, Popularity from random_user_agent.params
    # you can also set number of user agents required by providing `limit` as parameter

    software_names = [SoftwareName.CHROME.value]
    operating_systems = [OperatingSystem.WINDOWS.value]

    user_agent_rotator = UserAgent(software_names=software_names, operating_systems=operating_systems, limit=1)

    # Get list of user agents.
    user_agents = user_agent_rotator.get_user_agents()

    # Get Random User Agent String.
    user_agent = user_agent_rotator.get_random_user_agent()

    return user_agent


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


if __name__ == '__main__':
    pass
