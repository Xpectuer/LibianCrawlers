# -*- coding: UTF-8 -*-
import asyncio
from asyncio import sleep
from pathlib import Path
from typing import *

import aiofiles.ospath

from libiancrawlers.app_util.apicrawler_util.rollup_store import RollupStore
from libiancrawlers.app_util.config import read_config_get_path, read_config
from libiancrawlers.util.fs import mkdirs
from bilibili_api import Credential
from loguru import logger


async def _get_credential_store_dir():
    credential_store_dir = await read_config_get_path(*['crawler', 'api', 'bilibili', 'credential_store_dir'],
                                                      allow_null=True)
    if credential_store_dir is not None:
        return Path(credential_store_dir)

    return Path('.data') / 'apilib' / 'bilibili_api_python' / 'credential_store_dir'


_bilibili_credential_store_init_lock = asyncio.Lock()
_bilibili_credential_store: Optional[RollupStore] = None


# noinspection SpellCheckingInspection
async def _latest_bilibili_credential_from_store():
    global _bilibili_credential_store
    if _bilibili_credential_store is None:
        async with _bilibili_credential_store_init_lock:
            if _bilibili_credential_store is None:
                logger.debug('Start create _bilibili_credential_store')
                _bilibili_credential_store = RollupStore(
                    name='bilibili_credential_store',
                    desc='存放bilibili认证信息。',
                    store_dir=await _get_credential_store_dir(),
                    value_checker=None,
                )
                logger.debug('Start init _bilibili_credential_store')
                await _bilibili_credential_store.init()
                logger.debug('Finish init _bilibili_credential_store')
    obj = await _bilibili_credential_store.read_latest()
    if obj is None:
        return None
    if not isinstance(obj, dict):
        raise ValueError(f'credential info not isinstance Dict : type is {type(obj)} , value is {obj}')

    def _get_k_and_should_be_str(k: str):
        _res = obj.get(k)
        if isinstance(_res, int):
            _res = _res.__str__()
        if _res is None:
            return _res
        elif isinstance(_res, str):
            if _res.strip().__len__() <= 0:
                return None
            return _res
        else:
            raise ValueError(f'key {k} should be null or string , but type is {type(_res)} , value is {_res}')

    sessdata = _get_k_and_should_be_str('sessdata')
    bili_jct = _get_k_and_should_be_str('bili_jct')
    buvid3 = _get_k_and_should_be_str('buvid3')
    buvid4 = _get_k_and_should_be_str('buvid4')
    dedeuserid = _get_k_and_should_be_str('dedeuserid')
    ac_time_value = _get_k_and_should_be_str('ac_time_value')
    if all(map(lambda it: it is None, (sessdata, bili_jct, buvid3, buvid4, dedeuserid, ac_time_value))):
        return None
    else:
        return Credential(
            sessdata=sessdata,
            bili_jct=bili_jct,
            buvid3=buvid3,
            buvid4=buvid4,
            dedeuserid=dedeuserid,
            ac_time_value=ac_time_value,
        )


# noinspection SpellCheckingInspection
async def _latest_bilibili_credential_from_config():
    async def _get_k_and_should_be_str(k: str):
        _res = await read_config('crawler', 'apilib', 'bilibili', 'init_credential', k, allow_null=True)
        if isinstance(_res, int):
            _res = _res.__str__()
        if _res is None:
            return _res
        elif isinstance(_res, str):
            if _res.strip().__len__() <= 0:
                return None
            return _res
        else:
            raise ValueError(f'key {k} should be null or string , but type is {type(_res)} , value is {_res}')

    sessdata = await _get_k_and_should_be_str('sessdata')
    bili_jct = await _get_k_and_should_be_str('bili_jct')
    buvid3 = await _get_k_and_should_be_str('buvid3')
    buvid4 = await _get_k_and_should_be_str('buvid4')
    dedeuserid = await _get_k_and_should_be_str('dedeuserid')
    ac_time_value = await _get_k_and_should_be_str('ac_time_value')
    if all(map(lambda it: it is None, (sessdata, bili_jct, buvid3, buvid4, dedeuserid, ac_time_value))):
        return None
    else:
        return Credential(
            sessdata=sessdata,
            bili_jct=bili_jct,
            buvid3=buvid3,
            buvid4=buvid4,
            dedeuserid=dedeuserid,
            ac_time_value=ac_time_value,
        )


CheckCredentialResult = Tuple[bool, Literal['null', 'not_valid', 'err', 'ok'], Optional[Credential]]


async def check_credential(tag: str, cre: Optional[Credential]) -> CheckCredentialResult:
    try:
        logger.debug('start check credential tag={}', tag)
        if cre is None:
            logger.debug('not found credential tag={}', tag)
            return False, 'null', None
        _refreshed = False
        while True:
            if not await cre.check_valid():
                logger.warning('invalid bilibili credential tag={} : {}', tag, cre)
                return False, 'not_valid', cre
            if cre.ac_time_value is not None and cre.ac_time_value.strip().__len__() > 0:
                if await cre.check_refresh():
                    old_value = cre.__str__()
                    if _refreshed:
                        await sleep(5)
                    try:
                        await cre.refresh()
                    finally:
                        _refreshed = True
                    new_value = cre.__str__()
                    logger.debug('Refresh bilibili credential {}:\n    old: {}\n    new: {}', tag, old_value, new_value)
                if not await cre.check_valid():
                    logger.warning('invalid bilibili credential {} : {}', tag, cre)
                    return False, 'not_valid', cre
            else:
                logger.debug('ac_time_value is blank , skip refresh check . tag={}', tag)
            logger.debug('valid bilibili credential tag={} : {}', tag, cre)
            return True, 'ok', cre
    except BaseException:
        logger.exception('Failed to opt check credential tag={}', tag)
        return False, 'err', cre
    finally:
        logger.debug('finish check credential tag={}', tag)


# noinspection SpellCheckingInspection
async def latest_bilibili_credential() -> Optional[Credential]:
    cre_from_store = await check_credential('from_store', await _latest_bilibili_credential_from_store())
    cre_from_config = await check_credential('from_config', await _latest_bilibili_credential_from_config())
    logger.debug('cre_from_store is {}, cre_from_config is {}', cre_from_store, cre_from_config)
    if cre_from_store[0] and cre_from_config[0]:
        if cre_from_store[2].__str__() == cre_from_config[2].__str__():
            cre = cre_from_store
        else:
            logger.debug('find not same credential , cre_from_store={} , cre_from_config={}',
                         cre_from_store, cre_from_config)
            logger.debug('you can remove credential in config')
            cre = cre_from_store
    elif cre_from_config[0]:
        logger.debug('valid found credential from config')
        cre = cre_from_config
    elif cre_from_store[0]:
        logger.debug('valid credential from store')
        cre = cre_from_store
    else:
        logger.info('''
No valid credential from config or store

See: https://nemo2011.github.io/bilibili-api/#/get-credential

you need create in config file:

```toml
[crawler]
[crawler.apilib]
[crawler.apilib.bilibili]
[crawler.apilib.bilibili.init_credential]
sessdata=""
bili_jct=""
buvid3=""
buvid4=""
dedeuserid=""
ac_time_value=""
```

''')
        return None
    logger.debug('use valid credential : {}', cre)
    return cre[2]


if __name__ == '__main__':
    pass
