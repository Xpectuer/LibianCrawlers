# -*- coding: UTF-8 -*-
import asyncio
import base64
import os.path
from dataclasses import dataclass
from typing import Optional, Literal, Union, Dict, Callable, Awaitable, Tuple, Any
from urllib.parse import urlparse, parse_qs, parse_qsl

import playwright.async_api
# noinspection PyProtectedMember
from camoufox import AsyncCamoufox
from loguru import logger
# noinspection PyProtectedMember
from playwright.async_api import PlaywrightContextManager
from playwright.async_api import async_playwright, BrowserContext, Browser

from libiancrawlers.common.app_init import get_app_init_conf
from libiancrawlers.common.config import read_config, read_config_get_path
from libiancrawlers.common.types import AppInitConfDisable, LaunchBrowserParam

import aiofiles.os
import aiofiles.ospath

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
                      ],
                      launch_options=None):
    from libiancrawlers.common import filename_slugify

    if launch_options is None:
        launch_options = {}
    ctx = await _get_ctx()
    pw = await ctx.__aenter__()
    if mode == 'connect':
        ws_endpoint = await read_config('camoufox', 'server', 'ws-endpoint')
        browser: Browser = await pw.firefox.connect(ws_endpoint=ws_endpoint)
        browser_context = await browser.new_context()
    else:
        gecko_profile_dir = await read_config_get_path('crawler', 'gecko', 'profile-dir-base')
        browser_context: BrowserContext = await AsyncCamoufox(
            persistent_context=True,
            user_data_dir=os.path.join(gecko_profile_dir,
                                       filename_slugify(mode.browser_data_dir_id, allow_unicode=True)),
            **launch_options,
        ).__aenter__()
        browser: None = browser_context.browser
        # browser = browser_context.browser
        # if browser is None:
        #     raise ValueError('Why browser is None ?')
    logger.info('BrowserContext is {} , Browser is {}', browser_context, browser)
    return browser_context, browser


def url_parse_to_dict(url: Optional[str]):
    if url is None:
        return None
    _url = urlparse(url)
    return dict(
        url=url,
        url_len=len(url),
        scheme=_url.scheme,
        netloc=_url.netloc,
        path=_url.path,
        path_arr=_url.path.split('/'),
        path_arr_len=len(_url.path.split('/')),
        params=_url.params,
        query=_url.query,
        parse_qs=parse_qs(_url.query),
        parse_qsl=parse_qsl(_url.query),
        fragment=_url.fragment,
        username=_url.username,
        password=_url.password,
        hostname=_url.hostname,
        port=_url.port,
    )


async def response_to_dict(resp: Optional[playwright.async_api.Response]):
    if resp is None:
        return None
    return dict(
        url=url_parse_to_dict(resp.url),
        ok=resp.ok,
        status=resp.status,
        status_text=resp.status_text,
        headers=resp.headers,
        from_service_worker=resp.from_service_worker,
        request=await request_info_to_dict(resp.request),
        all_headers=await resp.all_headers(),
        headers_array=await resp.headers_array(),
        server_addr=await resp.server_addr(),
        security_details=await resp.security_details(),
    )


async def request_info_to_dict(req: Optional[playwright.async_api.Request]):
    if req is None:
        return None
    return dict(
        url=url_parse_to_dict(req.url),
        resource_type=req.resource_type,
        method=req.method,
        post_data_buffer=req.post_data_buffer,
        redirected_from=await request_info_to_dict(req.redirected_from),
        # redirected_to=await request_info_to_dict(req.redirected_to),
        failure=req.failure,
        timing=req.timing,
        headers=req.headers,
        sizes=await req.sizes(),
        is_navigation_request=req.is_navigation_request(),
        all_headers=await req.all_headers(),
        headers_array=await req.headers_array(),
    )


@dataclass
class BlobOutput:
    mode: Literal['ignore', 'file', 'base64']
    base_dir: Optional[str]
    filename: Optional[str]


async def _get_blob(*,
                    blob_output: Optional[BlobOutput],
                    func_mode_file: Callable[[str], Awaitable[Any]],
                    func_mode_base64: Callable[[], Awaitable[bytes]],
                    ):
    if blob_output is None:
        return None
    if blob_output.mode == 'file':
        base_dir = blob_output.base_dir
        if base_dir is None or len(blob_output.base_dir) == 0:
            raise ValueError('require set base_dir on blob_output.mode==file')
        if not await aiofiles.ospath.isdir(base_dir):
            raise OSError(f'require isdir : {base_dir}')
        filename = blob_output.filename
        if filename is None or len(blob_output.filename) == 0:
            raise ValueError('require set filename on blob_output.mode==file')
        output_file_path = os.path.join(base_dir, filename)
        await func_mode_file(output_file_path)
        return output_file_path
    if blob_output.mode == 'base64':
        return base64.b64encode(await func_mode_base64()).decode()

    return None


async def page_info_to_dict(page: playwright.async_api.Page, *,
                            on_screenshot: Optional[BlobOutput] = None,
                            ):
    async def screenshot_mode_file(pth: str):
        return await page.screenshot(
            type='png',
            path=pth,
            full_page=True,
            scale='css',
        )

    async def screenshot_mode_base64():
        return await page.screenshot(
            type='png',
            full_page=True,
            scale='css',
        )

    return dict(
        url=url_parse_to_dict(page.url),
        viewport_size=page.viewport_size,
        video=None if page.video is None else dict(
            path=await page.video.path()
        ),
        title=await page.title(),
        is_closed=page.is_closed(),
        screenshot=await _get_blob(
            blob_output=on_screenshot,
            func_mode_file=screenshot_mode_file,
            func_mode_base64=screenshot_mode_base64,
        )
    )


if __name__ == '__main__':
    pass
