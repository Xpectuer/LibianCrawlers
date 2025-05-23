# -*- coding: UTF-8 -*-

from loguru import logger

logger.debug('camoufox import')

from typing import Optional, Union, Tuple

from camoufox.locale import get_geolocation

from libiancrawlers.app_util.networks.geoutil import get_geo
from libiancrawlers.app_util.networks.iputil import MyPublicIpInfo
from libiancrawlers.app_util.networks.proxies import read_current_schema_proxies
from libiancrawlers.util.dicts import find_first_value_not_null


async def read_proxy_server():
    read_proxies = await read_current_schema_proxies()
    logger.debug('read proxies is {}', read_proxies)
    if read_proxies is not None:
        is_found_proxy, _schema, addr = find_first_value_not_null(
            read_proxies,
            keys=['https', 'http'])
        if is_found_proxy:
            return addr
    return None


async def get_best_launch_options(
        *,
        my_public_ip_info: MyPublicIpInfo,
        os: Optional[Union[str, Tuple[str]]] = None,
        headless=False,
        locale: Optional[str] = None,
        debug: Optional[bool] = None,
        proxy_server: Optional[str] = None,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
        is_mobile: Optional[bool] = None,
        has_touch: Optional[bool] = None,
        need_page_go_back_go_forward: Optional[bool] = None,
):
    logger.debug('get best launch options params : {}', locals())
    if proxy_server is None:
        logger.debug('not set proxy param , we will checking ...')
        proxy_server = await read_proxy_server()
    if need_page_go_back_go_forward is None:
        need_page_go_back_go_forward = True
    proxy = None if \
        proxy_server is None \
        and proxy_username is None \
        and proxy_password is None \
        else \
        dict(
            **({} if proxy_server is None else dict(server=proxy_server)),
            **({} if proxy_username is None else dict(username=proxy_username)),
            **({} if proxy_password is None else dict(password=proxy_password)),
        )
    logger.debug('proxy is {}', proxy)
    if os is None:
        os = ['windows']
    if isinstance(os, str):
        os = os.split(',')
    logger.debug('os is {}', os)
    if is_mobile is None:
        is_mobile = None
    if has_touch is None:
        has_touch = True
    # launch_options()

    public_ip_v4 = my_public_ip_info.get('public_ip_v4')
    if public_ip_v4 is not None:
        geo_v4 = await get_geo(public_ip_v4)

    public_ip_v6 = my_public_ip_info.get('public_ip_v6')
    if public_ip_v6 is not None:
        geo_v6 = await get_geo(public_ip_v6)

    res = dict(
        os=os,
        headless=headless,
        humanize=True,
        is_mobile=is_mobile,
        has_touch=has_touch,
        geoip=True,
        proxy=proxy,
        locale=locale if proxy is None else None,
        debug=debug,
        enable_cache=need_page_go_back_go_forward,
        config={
            'screen.availWidth': 1824,
            'screen.availHeight': 988,
            'screen.width': 1920,
            'screen.height': 1080,
            'screen.colorDepth': 24,
            'screen.pixelDepth': 24,
            'screen.availTop': 0,
            'screen.availLeft': 0,
        },
        firefox_user_prefs={
        },
    )
    logger.debug('return best launch options : {}', res)
    return res


if __name__ == '__main__':
    pass
