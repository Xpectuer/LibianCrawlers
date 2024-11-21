# -*- coding: UTF-8 -*-
from typing import Optional
from loguru import logger

from camoufox.server import launch_server


def launch_server_from_cli(
        *,
        headless=False,
        geoip=True,
        proxy_server: Optional[str] = None,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
):
    logger.debug('cli params : {}', locals())
    proxy = None if proxy_server is None and proxy_username is None and proxy_password is None else dict(
        **({} if proxy_server is None else dict(server=proxy_server)),
        **({} if proxy_username is None else dict(username=proxy_username)),
        **({} if proxy_password is None else dict(password=proxy_password)),
    )
    logger.debug('proxy is {}', proxy)
    launch_server(
        headless=headless,
        geoip=geoip,
        proxy=proxy,
    )


def cli():
    from fire import Fire
    Fire(launch_server_from_cli)


if __name__ == '__main__':
    pass
