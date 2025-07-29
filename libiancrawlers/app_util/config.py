# -*- coding: UTF-8 -*-
import json
import os
import sys

from typing import Optional, Callable, Any, Awaitable, Union, NoReturn

import aiofiles
import async_to_sync
from confection import Config
from loguru import logger

from libiancrawlers.util.fs import mkdirs, aios, aios_symlink
from libiancrawlers.util.plat import is_windows


def is_config_truthy(s: Union[None, str, bool]):
    if s is None:
        raise ValueError('Can not test truthy for None')
    if isinstance(s, bool):
        return s
    elif isinstance(s, int):
        return not s == 0
    elif isinstance(s, str):
        y = (s.lower() == 'true'
             or s == '1'
             or s.lower() == 'yes'
             or s.lower() == 'y')
        n = (s.lower() == 'false'
             or s == '0'
             or s.lower() == 'no'
             or s.lower() == 'n')
        if not y and not n:
            raise ValueError('Invalid config boolean %s' % s)
        return y
    else:
        raise ValueError('Unsupported type %s : %s' % (type(s), s))


_READIED_CONFIG = None

SysExitExConfig = Callable[[], Awaitable[Union[None, NoReturn]]]

EX_CONFIG = 78


async def _sys_exit_config() -> NoReturn:
    if is_windows():
        # noinspection PyUnresolvedReferences,PyProtectedMember
        os._exit(EX_CONFIG)
    else:
        sys.exit(EX_CONFIG)
    # noinspection
    assert not 'Config error but not exit'


async def read_config(*args: str,
                      sys_exit: Optional[SysExitExConfig] = None,
                      checking_sync: Optional[Callable[[Any], Optional[str]]] = None,
                      allow_null: bool = False,
                      ):
    global _READIED_CONFIG
    if _READIED_CONFIG is None:
        _READIED_CONFIG = await _read_config(sys_exit=sys_exit)
    o = _READIED_CONFIG
    arg = None
    try:
        for arg in args:
            if not allow_null:
                o = o[arg]
            else:
                o = o.get(arg)
                if o is None:
                    break
        err_msg = checking_sync(o) if checking_sync is not None else None
        if err_msg:
            raise ValueError('Invalid config %s : %s' % (args, err_msg))
        return o
    except BaseException:
        logger.error('Error on read config : config is {}',
                     json.dumps(_READIED_CONFIG, ensure_ascii=False, indent=2))
        logger.exception('Failed read config path {} , current : arg={} , o={}',
                         args, arg, json.dumps(o, ensure_ascii=False, indent=2))
        raise


async def _get_config_template():
    async with aiofiles.open('crawler_config_template.cfg', mode='rt', encoding='utf-8') as f:
        return await f.read()


async def _read_config(*, sys_exit: Optional[SysExitExConfig] = None):
    config_dir = os.path.join(os.path.expanduser("~"), '.libian', 'crawler', 'config')
    await mkdirs(config_dir)
    config_file_path = os.path.join(config_dir, 'v1.cfg')
    should_exit = False
    if not await aios.path.exists(config_file_path):
        async with aiofiles.open(config_file_path, mode='w+', encoding='utf-8') as f:
            logger.warning('Not exist config dir , auto create it at {}', config_file_path)
            await f.write(await _get_config_template())
        if should_exit:
            logger.warning('Please rewrite config file at {}', config_file_path)
        should_exit = True
    config_symlink_path = os.path.join('.data', 'config.cfg')
    if not await aios.path.exists(config_symlink_path):
        await mkdirs('.data')
        await aios_symlink(config_file_path, config_symlink_path)
        logger.info('Create symlink at {}', config_symlink_path)
        if should_exit:
            logger.warning('Please rewrite config file (it\'s symlink) at {}', config_symlink_path)
    if should_exit:
        return await sys_exit() if sys_exit is not None else await _sys_exit_config()
    logger.debug('Start read config from {}', config_dir)
    # noinspection PyBroadException

    try:
        async with aiofiles.open(config_file_path, mode='r+', encoding='utf-8') as f:
            config_str = await f.read()
        config = Config().from_str(config_str)
    except BaseException:
        logger.exception('Error on read config file at {}', config_file_path)
        logger.error('Please open the config dir and delete/modify the file:\n\t' + config_file_path)
        return await sys_exit() if sys_exit is not None else await _sys_exit_config()
    logger.debug('Config is {}', json.dumps(config, indent=2, ensure_ascii=False))
    return config


async def read_config_get_path(*args: str, create_if_not_exist: bool = False, allow_null: bool = False):
    async def get_path():
        v: Optional[str] = await read_config(*args,
                                             allow_null=allow_null,
                                             checking_sync=lambda it: None
                                             if isinstance(it, str) or (allow_null and it is None)
                                             else 'Should be str')
        if v is None:
            if not allow_null:
                raise ValueError('Config missing')
            return None
        p = v.replace('{{HOME}}', os.path.expanduser('~')).replace('/', os.sep)
        logger.debug('get path from config : args={} , v={} , p={}', args, v, p)
        return p

    pth = await get_path()
    if create_if_not_exist and not await aios.path.exists(pth):
        await mkdirs(pth)

    return pth


read_config_sync = async_to_sync.function(read_config)

if __name__ == '__main__':
    pass
