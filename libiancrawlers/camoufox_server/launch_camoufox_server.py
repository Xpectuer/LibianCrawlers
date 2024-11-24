# -*- coding: UTF-8 -*-
from typing import Optional, Union, Tuple

from camoufox.server import launch_server
from loguru import logger


def launch_camoufox_server(
        *,
        os: Optional[Union[str, Tuple[str]]] = None,
        headless=False,
        geoip=True,
        humanize=True,
        locale=None,
        debug: Optional[bool] = None,
        proxy_server: Optional[str] = None,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
):
    logger.debug('cli params : {}', locals())
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
    launch_server(
        os=os,
        headless=headless,
        humanize=humanize,
        geoip=geoip,
        proxy=proxy,
        locale=locale,
        args=['--profile', 'zhihu'],
        debug=debug,
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
    )


def cli():
    from fire import Fire
    Fire(launch_camoufox_server)


if __name__ == '__main__':
    pass
