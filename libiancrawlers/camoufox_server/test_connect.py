# -*- coding: UTF-8 -*-
import asyncio

import async_to_sync
from playwright.async_api import async_playwright

from libiancrawlers.common import read_config


def to_browser_scan():
    async_to_sync.function(to_browser_scan_async)()


async def to_browser_scan_async():
    ws_endpoint = read_config('camoufox', 'server', 'ws-endpoint')
    async with async_playwright() as playwright:
        browser = await playwright.firefox.connect(ws_endpoint=ws_endpoint)
        page = await browser.new_page()
        await page.goto("https://browserscan.net")
        while not page.is_closed():
            await asyncio.sleep(1)
        await browser.close()


if __name__ == '__main__':
    pass
