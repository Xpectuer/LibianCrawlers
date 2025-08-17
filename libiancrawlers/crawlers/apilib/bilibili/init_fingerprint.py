# -*- coding: UTF-8 -*-
from loguru import logger

from libiancrawlers.app_util.networks import update_proxies
from libiancrawlers.app_util.networks.proxies import read_proxy_server, monkey_patch_hook_urllib

_fingerprint_inited: bool = False


async def init_fingerprint(*, impersonate: str = 'chrome', use_proxy: bool):
    global _fingerprint_inited
    if _fingerprint_inited:
        raise ValueError('Fingerprint already init')

    logger.debug('Start init bilibili api fingerprint')
    await monkey_patch_hook_urllib()

    # noinspection PyUnresolvedReferences
    import curl_cffi
    logger.debug('import curl_cffi finish')

    from bilibili_api import select_client
    select_client("curl_cffi")  # 选择 curl_cffi，支持伪装浏览器的 TLS / JA3 / Fingerprint
    logger.debug('select client curl_cffi finish')

    from bilibili_api import request_settings
    request_settings.set("impersonate", impersonate)

    if use_proxy:
        await update_proxies()
        proxy_server = await read_proxy_server()
        if proxy_server is not None:
            logger.debug('set proxy : {}', proxy_server)
            request_settings.set_proxy(proxy_server)
            logger.debug('set proxy finish')

    logger.debug('request_settings.get_all() is : {}', request_settings.get_all())
    _fingerprint_inited = True


if __name__ == '__main__':
    pass
