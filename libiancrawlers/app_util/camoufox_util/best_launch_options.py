# -*- coding: UTF-8 -*-
import os.path

import aiofiles.os
from loguru import logger

from libiancrawlers.app_util.networks.proxies import read_proxy_server

logger.debug('camoufox import')

from typing import Optional, Union, Tuple

# noinspection PyUnresolvedReferences
from camoufox.locale import get_geolocation

from libiancrawlers.app_util.networks.geoutil import get_geo
from libiancrawlers.app_util.networks.iputil import MyPublicIpInfo


async def get_best_launch_options(
        *,
        my_public_ip_info: MyPublicIpInfo,
        _os: Optional[Union[str, Tuple[str]]] = None,
        headless=False,
        locale: Optional[str] = None,
        debug: Optional[bool] = None,
        proxy_server: Optional[str] = None,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
        is_mobile: Optional[bool] = None,
        has_touch: Optional[bool] = None,
        need_page_go_back_go_forward: Optional[bool] = None,
        addons_root_dir: Optional[str] = None,
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
    if _os is None:
        _os = ['windows']
    if isinstance(_os, str):
        _os = _os.split(',')
    logger.debug('os is {}', _os)
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

    addons = []
    if addons_root_dir is not None and addons_root_dir.strip().__len__() > 0:
        addons_root_dir = addons_root_dir.replace('/', os.path.sep)

        async def _find_addon(cur: str):
            filename_list = await aiofiles.os.listdir(cur)
            if 'manifest.json' in filename_list:
                addons.append(os.path.abspath(cur))
            else:
                for filename in filename_list:
                    nxt = os.path.join(cur, filename)
                    if await aiofiles.os.path.isdir(nxt):
                        await _find_addon(nxt)

        await _find_addon(addons_root_dir)

    logger.debug('addons is {}', addons)

    res = dict(
        os=_os,
        headless=headless,
        humanize=True,
        is_mobile=is_mobile,
        has_touch=has_touch,
        geoip=True,
        proxy=proxy,
        locale=locale if proxy is None else None,
        debug=debug,
        enable_cache=need_page_go_back_go_forward,
        firefox_user_prefs={
        },
        addons=addons if addons.__len__() > 0 else None,
    )
    logger.debug('return best launch options : {}', res)
    return res


if __name__ == '__main__':
    pass
