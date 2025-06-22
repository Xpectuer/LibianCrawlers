# -*- coding: UTF-8 -*-
import asyncio
from typing import Union

import async_to_sync
from loguru import logger

from libiancrawlers.app_util.networks import update_proxies


def to_check_leak_website():
    async_to_sync.function(goto_website)([
        "https://browserscan.net",
        'https://browserleaks.com/webrtc',
    ])


def to_check_go_back_button_available():
    async_to_sync.function(goto_website)(
        "https://stackoverflow.com/questions/74305598/is-it-possible-to-click-the-back-button-in-the-browser-using-playwright")


async def goto_website(urls: Union[list[str]]):
    from libiancrawlers.app_util.app_init import init_app, Initiator, exit_app

    init_app(Initiator(playwright=True, postgres=False))

    from libiancrawlers.app_util.camoufox_util.best_launch_options import get_best_launch_options, read_proxy_server
    from libiancrawlers.app_util.playwright_util import get_browser
    from libiancrawlers.app_util.types import LaunchBrowserParam
    from libiancrawlers.app_util.networks.iputil import get_my_public_ip_info

    if isinstance(urls, str):
        urls = [urls]

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

        idx = 0
        for url in urls:
            if len(browser_context.pages) > idx:
                page = browser_context.pages[idx]
            else:
                page = await browser_context.new_page()
            await page.bring_to_front()
            await page.goto(url)
            idx += 1
        while not all(map(lambda it: it.is_closed(), browser_context.pages)):
            await asyncio.sleep(1)
    finally:
        if browser_context is not None:
            await browser_context.close()
        await exit_app()


if __name__ == '__main__':
    pass
