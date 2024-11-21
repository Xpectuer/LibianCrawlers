# -*- coding: UTF-8 -*-
from typing import Optional

from camoufox.server import launch_server


def cli(*,
        headless=False,
        geoip=True,
        proxy_server: Optional[str] = None,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
        ):
    proxy = None if proxy_server is None and proxy_username is None and proxy_password is None else dict(
        server=proxy_server,
        username=proxy_username,
        password=proxy_password,
    )

    launch_server(
        headless=headless,
        geoip=geoip,
        proxy=proxy,
    )


if __name__ == '__main__':
    pass
