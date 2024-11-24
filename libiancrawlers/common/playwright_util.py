# -*- coding: UTF-8 -*-
import asyncio
import os.path
from typing import Optional, Literal, Union

# noinspection PyProtectedMember
from camoufox import AsyncCamoufox
from loguru import logger
# noinspection PyProtectedMember
from playwright.async_api import PlaywrightContextManager
from playwright.async_api import async_playwright, BrowserContext, Browser

from libiancrawlers.common.app_init import get_app_init_conf
from libiancrawlers.common.config import read_config, read_config_get_path
from libiancrawlers.common.types import AppInitConfDisable, LaunchBrowserParam

PLAYWRIGHT_LOCK = asyncio.Lock()
PLAYWRIGHT_CONTEXT: Optional[PlaywrightContextManager] = None


async def shutdown_playwright():
    global PLAYWRIGHT_CONTEXT
    if PLAYWRIGHT_CONTEXT is None:
        return
    async with PLAYWRIGHT_LOCK:
        if PLAYWRIGHT_CONTEXT is None:
            return
        logger.info('Start exit playwright context')
        await PLAYWRIGHT_CONTEXT.__aexit__()
        logger.debug('Success exit playwright context')
        PLAYWRIGHT_CONTEXT = None


async def _get_ctx():
    global PLAYWRIGHT_CONTEXT
    if PLAYWRIGHT_CONTEXT is None:
        async with PLAYWRIGHT_LOCK:
            if not get_app_init_conf().playwright:
                raise AppInitConfDisable('playwright')
            if PLAYWRIGHT_CONTEXT is None:
                PLAYWRIGHT_CONTEXT = async_playwright()
    return PLAYWRIGHT_CONTEXT


async def get_browser(*,
                      mode: Union[
                          Literal["connect"],
                          LaunchBrowserParam,
                      ]):
    ctx = await _get_ctx()
    playwright = await ctx.__aenter__()
    if mode == 'connect':
        ws_endpoint = read_config('camoufox', 'server', 'ws-endpoint')
        browser: Browser = await playwright.firefox.connect(ws_endpoint=ws_endpoint)
        browser_context = await browser.new_context()
    else:
        gecko_profile_dir = await read_config_get_path('crawler', 'gecko', 'profile-dir-base')
        browser_context: BrowserContext = await AsyncCamoufox(
            persistent_context=True,
            user_data_dir=os.path.join(gecko_profile_dir, mode.browser_data_dir_id)
        ).__aenter__()
        browser: None = browser_context.browser
        # browser = browser_context.browser
        # if browser is None:
        #     raise ValueError('Why browser is None ?')
    logger.info('BrowserContext is {} , Browser is {}', browser_context, browser)
    return browser_context, browser


if __name__ == '__main__':
    pass
