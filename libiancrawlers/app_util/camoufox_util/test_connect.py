# -*- coding: UTF-8 -*-
import asyncio

import async_to_sync
from loguru import logger

from libiancrawlers.common.networks import update_proxies


def to_browser_scan():
    async_to_sync.function(goto_website)("https://browserscan.net")


def to_ip138():
    async_to_sync.function(goto_website)("https://ip138.com")


async def goto_website(url: str):
    from libiancrawlers.app_util.camoufox_util.best_launch_options import get_best_launch_options, read_proxy_server
    from libiancrawlers.app_util.app_init import init_app, Initiator, exit_app
    from libiancrawlers.app_util.playwright_util import get_browser
    from libiancrawlers.app_util.types import LaunchBrowserParam
    from libiancrawlers.app_util.networks.iputil import get_my_public_ip_info

    init_app(Initiator(playwright=True, postgres=False))
    browser_context = None
    try:
        await update_proxies()
        proxy_server = await read_proxy_server()
        my_public_ip_info = await get_my_public_ip_info()
        logger.debug('start get browser')
        browser_context, _ = await get_browser(
            mode=LaunchBrowserParam(browser_data_dir_id='test_connect_to_browser_scan_async'),
            my_public_ip_info=my_public_ip_info,
            launch_options=await get_best_launch_options(
                proxy_server=proxy_server,
                my_public_ip_info=my_public_ip_info,
            )
        )
        page = await browser_context.new_page()
        await page.bring_to_front()
        await page.goto(url)
        while not page.is_closed():
            await asyncio.sleep(1)
    finally:
        if browser_context is not None:
            await browser_context.close()
        await exit_app()


if __name__ == '__main__':
    pass
