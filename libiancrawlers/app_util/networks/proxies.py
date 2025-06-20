# -*- coding: UTF-8 -*-
import asyncio
import os
from copy import deepcopy
from typing import *
from curl_cffi import requests

from loguru import logger

from libiancrawlers.util.coroutines import blocking_func, sleep


async def clear_schema_proxies():
    async with _update_proxies_lock:
        _clear_schema_proxies_without_lock()


def _clear_schema_proxies_without_lock():
    logger.debug('Clear schema proxies ...')
    global _current_schema_proxies
    if _current_schema_proxies is None:
        return
    old = _current_schema_proxies
    _current_schema_proxies = None
    for schema in old.keys():
        k = f'{schema}_proxy'
        old_v = os.environ.get(k)
        del os.environ[k]
        logger.debug(f'Clear {k} : {old_v} ==> {os.environ.get(k)}')


def _set_schema_proxy_without_lock(schema: str, address: str):
    logger.debug('Set proxy : {} ==> {}', schema, address)
    global _current_schema_proxies
    if _current_schema_proxies is None:
        _current_schema_proxies = dict()
    _current_schema_proxies[schema] = address
    os.environ[f'{schema}_proxy'] = address


_current_schema_proxies: Optional[Dict[str, str]] = None


async def read_current_schema_proxies():
    async with _update_proxies_lock:
        return deepcopy(_current_schema_proxies)


UpdateProxiesCode = Literal[
    'return_if_true_after_enter_lock', 'proxy_disable', 'ok', 'unsupported', 'winreg_key_not_found']


@blocking_func(
    disk_accessing_using_blocking_apis=True
)
def _read_winreg_for_update_proxies() -> Tuple[UpdateProxiesCode, Any]:
    logger.debug("Read winreg for update proxies ...")
    import winreg
    sub_key = 'Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
    k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, sub_key)
    try:
        proxy_enable, _ = winreg.QueryValueEx(k, 'ProxyEnable')
        logger.debug('Windows proxy_enable : {}', proxy_enable)
        if proxy_enable == 0:
            return "proxy_disable", None
        proxy_server, _ = winreg.QueryValueEx(k, 'ProxyServer')
        logger.debug('Windows proxy_server : {}', proxy_server)
        result = []
        for proxy_conf in str(proxy_server).split(';'):
            split_proxy_conf = proxy_conf.split('=', 2)
            if split_proxy_conf.__len__() < 2:
                address = proxy_conf
                for soft_protocol in ['https', 'http']:
                    try:
                        resp = requests.request('GET', f'{soft_protocol}://{address}')
                        logger.debug('detect soft protocol is {} for proxy software {} response : {}', soft_protocol,
                                     address,
                                     resp)
                        break
                    except BaseException as err:
                        logger.debug('detect soft protocol not {} for proxy software {} : {}', soft_protocol, address,
                                     err)
                else:
                    logger.warning('Can not detect protocol for proxy software {} , use default http', address)
                    soft_protocol = 'http'
                for schema in ['https', 'http']:
                    result.append((schema, f'{soft_protocol}://{address}'))
            else:
                schema, address = proxy_conf.split('=')
                result.append((schema, address))
        return "ok", result
    except FileNotFoundError as err:
        logger.debug('Read HKCU {} but nothing to found , it sames like no proxy enable')
        return "winreg_key_not_found", err
    finally:
        k.Close()


_update_proxies_lock = asyncio.Lock()


def _default_proxies_soft_schema_map(schema: str):
    if schema == 'socks':
        return 'socks'
    else:
        return 'http'


_proxies_soft_schema_conf_key = ["network", "proxy", "schema_mapping"]


# def _get_proxies_soft_schema(schema: str, proxy_soft_schema: Any) -> str:
#     def _err():
#         return Exception(
#             f'Config {_proxies_soft_schema_conf_key} require None | str | Dict[str,str] , but {proxy_soft_schema} , it '
#             + f'happen on _get_proxies_soft_schema {schema}')
#
#     if proxy_soft_schema is None:
#         return _default_proxies_soft_schema_map(schema)
#     elif isinstance(proxy_soft_schema, str):
#         return proxy_soft_schema
#     elif isinstance(proxy_soft_schema, dict):
#         if proxy_soft_schema.get(schema) is None:
#             return _default_proxies_soft_schema_map(schema)
#         elif isinstance(proxy_soft_schema[schema], str):
#             return proxy_soft_schema[schema]
#         else:
#             raise _err()
#     else:
#         raise _err()


async def update_proxies(
        *,
        return_if_true_after_enter_lock: Optional[Callable[[], Awaitable[bool]]] = None
) -> Tuple[UpdateProxiesCode, Any]:
    """
    更新代理信息。

    :param return_if_true_after_enter_lock: 用于传入 Double check lock 条件，如果其返回值为 True 则会直接返回。
    :return:
    """
    logger.debug('Update proxies ...')

    from libiancrawlers.util.plat import is_windows
    if is_windows():
        return await update_proxies_for_win32(return_if_true_after_enter_lock=return_if_true_after_enter_lock)
    else:
        logger.debug("I can't detect proxies , i need you to add some code at here")
        return "unsupported", None


async def update_proxies_for_win32(
        *,
        return_if_true_after_enter_lock: Optional[Callable[[], Awaitable[bool]]]
) -> Tuple[UpdateProxiesCode, Any]:
    async with _update_proxies_lock:
        if return_if_true_after_enter_lock is not None:
            dcl_result = await return_if_true_after_enter_lock()
            if dcl_result:
                return "return_if_true_after_enter_lock", None

        # noinspection PyUnresolvedReferences
        ret_code, ret_data = await _read_winreg_for_update_proxies()
        if ret_code == 'proxy_disable':
            _clear_schema_proxies_without_lock()
            return 'proxy_disable', ret_data
        if ret_code == 'ok':
            _ret_data: List[Tuple[str, str]] = ret_data
            # noinspection PyTypeChecker
            # proxy_soft_schema = await get_config(_proxies_soft_schema_conf_key,
            #                                      nullable=True)
            for schema, address in _ret_data:
                import re
                if re.match('(.+)://(.+)', address) is None:  # Missing schema
                    address = f'{schema}://{address}'
                    # address = f'{_get_proxies_soft_schema(schema, proxy_soft_schema)}://{address}'

                _set_schema_proxy_without_lock(
                    schema,
                    address,
                )
            return 'ok', ret_data
    raise ValueError("bug")


def monkey_patch_hook_urllib():
    import urllib.request

    logger.debug('[urllib hooking] start hook')
    from opentelemetry.instrumentation.urllib import URLLibInstrumentor

    import asyncio
    # running_loop = asyncio.get_running_loop()
    # if running_loop is not None:
    #     logger.debug('[urllib hooking] update proxies sync start , loop is {}', running_loop)
    #     _res = update_proxies()
    #     logger.debug('[urllib hooking] update proxies sync result : {}', _res)
    #     while _res.cr_running:
    #         sleep(0.1)
    # else:
    loop = None
    try:
        logger.debug('[urllib hooking] new loop start')
        loop = asyncio.new_event_loop()
        logger.debug('[urllib hooking] new loop is {}', loop)
        logger.debug('[urllib hooking] wait to update proxies')
        _res = loop.run_until_complete(update_proxies())
        logger.debug('[urllib hooking] success to update proxies , current is {} , result is {}',
                     _current_schema_proxies, _res)
    finally:
        if loop is not None:
            logger.debug('[urllib hooking] close loop {}', loop)
            loop.close()

    # `request_obj` is an instance of urllib.request.Request
    def request_hook(span, request_obj):
        request_obj: urllib.request.Request = request_obj
        logger.debug('[urllib hooking]\n    request is {}\n    has_proxy is {}',
                     request_obj.full_url, request_obj.has_proxy())
        if _current_schema_proxies is not None and not request_obj.has_proxy():
            for schema, address in _current_schema_proxies.items():
                logger.debug('[urllib hooking] set request proxy -- address {} , schema {}\n    request is {}',
                             address, schema, request_obj.full_url)
                request_obj.set_proxy(address, schema)

    def response_hook(span, request_obj, response_obj):
        request_obj: urllib.request.Request = request_obj
        import http.client
        response_obj: Optional[http.client.HTTPResponse] = response_obj
        logger.debug('[urllib hooking]\n    response is {}\n    resp status is {}\n    request is {}',
                     response_obj,
                     response_obj.status if response_obj is not None else None,
                     request_obj.full_url)

    logger.debug('[urllib hooking] inject instrument')
    URLLibInstrumentor().instrument(
        request_hook=request_hook, response_hook=response_hook
    )
    logger.debug('[urllib hooking] hooked')


if __name__ == '__main__':
    pass
