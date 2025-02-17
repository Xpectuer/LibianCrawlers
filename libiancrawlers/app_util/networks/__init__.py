# -*- coding: UTF-8 -*-
import asyncio
import os
from typing import Union, List, Tuple, Optional, Callable, Coroutine, Any

from loguru import logger

from libiancrawlers.app_util.networks.proxies import update_proxies
from libiancrawlers.util.timefmt import logd_time
from libiancrawlers.util.coroutines import blocking_func


async def request_connect_testing(url: str, *, mth: str = 'GET', timeout: float = 5):
    import inspect

    cur_frame = inspect.currentframe()
    cal_frame = inspect.getouterframes(cur_frame, 2)
    caller = f'{os.path.split(cal_frame[1][1])[-1]}:{cal_frame[1][2]}'

    async def __request_connect_testing_logs(
            func: Callable[[str], Coroutine[Any, Any, Tuple[bool, str, Optional[BaseException]]]]):
        func_name = func.__name__
        try:
            result = await func(url)
            logger.debug('{}{}  . func_name is {} , method is {} , result is {} ,caller is {}',
                         '🟢' if result[0] else '🔴' if result[1] == 'timeout' else '❌',
                         url,
                         func_name,
                         mth,
                         result,
                         caller)
            return result
        except BaseException:
            logger.error('Error on [request_connect_testing {}] {} {} , caller is {}', func_name, mth, url, caller)
            raise

    async def _aiohttp_task(_url: str = url):
        import aiohttp
        from aiohttp import ClientTimeout

        try:
            async with aiohttp.ClientSession(timeout=ClientTimeout(total=timeout), trust_env=True) as session:
                async with session.request(mth, _url) as resp:
                    await resp.text()
                    return True, "ok", None
        except asyncio.TimeoutError as err:
            return False, "timeout", err
        except BaseException as err:
            return False, "other", err

    @blocking_func(network_accessing_using_blocking_apis=True, disable_log_debug=True)
    def _requests_task(_url: str):
        import requests.adapters
        try:
            resp = requests.request(mth, _url, timeout=timeout)
            resp.text.split('\n\n\n\n')
            return True, "ok", None
        except requests.exceptions.Timeout as err:
            return False, "timeout", err
        except BaseException as err:
            return False, "other", err

    _task_result_list = await asyncio.gather(
        __request_connect_testing_logs(_aiohttp_task),
        __request_connect_testing_logs(_requests_task)
    )
    for _task_result in _task_result_list:
        if not _task_result[0]:
            return _task_result
    return True, "ok", None


_can_connect_to_url_lock = asyncio.Lock()


@logd_time
async def require_can_connect_to_urls(_urls: Union[List[str], str], *, timeout: float = 8, not_update_proxies=False):
    if isinstance(_urls, str):
        urls = [_urls]
    else:
        urls = _urls

    async def _can_connect_to_all() -> Tuple[bool, Optional[BaseException]]:
        for result in await asyncio.gather(*list(request_connect_testing(url, timeout=timeout) for url in urls)):
            can_connect, _, _err = result
            if not can_connect:
                return False, _err
        return True, None

    can_conn, _ = await _can_connect_to_all()
    if can_conn:
        return

    _on_acquire_is_locked = _can_connect_to_url_lock.locked()
    if _on_acquire_is_locked:
        logger.debug('Other coroutine is updating proxies , so _can_connect_to_url_lock is locked .')

    async with _can_connect_to_url_lock:
        if _on_acquire_is_locked:
            can_conn, _ = await _can_connect_to_all()
            if can_conn:
                return

        if not not_update_proxies:
            await update_proxies()

        can_conn, err = await _can_connect_to_all()
        if not can_conn:
            raise err


if __name__ == '__main__':
    pass
