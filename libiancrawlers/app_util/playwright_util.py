# -*- coding: UTF-8 -*-
import asyncio
import json
import os.path
import pathlib
import typing
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Literal, Union, Dict, Callable, Awaitable, Any, TypedDict, List, Tuple

import aiofiles.os
import aiofiles.ospath

from libiancrawlers.app_util.magic_util import MagicInfo
from libiancrawlers.app_util.networks.proxies import monkey_patch_hook_urllib
from libiancrawlers.app_util.obj2dict_util import url_parse_to_dict, ResultOfUrlParseToDict
from libiancrawlers.util.exceptions import is_timeout_error

import playwright.async_api

from loguru import logger
# noinspection PyProtectedMember
from playwright.async_api import PlaywrightContextManager, Frame
from playwright.async_api import async_playwright, BrowserContext
from playwright.sync_api import ViewportSize

from libiancrawlers.app_util.app_init import get_app_init_conf
from libiancrawlers.app_util.config import read_config, read_config_get_path, is_config_truthy
from libiancrawlers.app_util.networks.iputil import MyPublicIpInfo
from libiancrawlers.app_util.types import LibianCrawlerInitConfDisabled, LaunchBrowserParam
from libiancrawlers.util.fs import filename_slugify, get_file_hash_sha1

if True:
    # noinspection PyUnresolvedReferences
    import aiohttp

T = typing.TypeVar('T')

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


async def get_global_playwright_context():
    global PLAYWRIGHT_CONTEXT
    if PLAYWRIGHT_CONTEXT is None:
        async with PLAYWRIGHT_LOCK:
            if not get_app_init_conf().playwright:
                raise LibianCrawlerInitConfDisabled('playwright')
            if PLAYWRIGHT_CONTEXT is None:
                PLAYWRIGHT_CONTEXT = async_playwright()
    return PLAYWRIGHT_CONTEXT


async def get_browser(*,
                      mode: Union[
                          # Literal["connect"],
                          LaunchBrowserParam,
                      ],
                      my_public_ip_info: MyPublicIpInfo,
                      launch_options: Dict[str, Any],
                      ):
    await monkey_patch_hook_urllib()
    logger.debug('camoufox import')
    from camoufox import AsyncCamoufox

    # if mode == 'connect':
    #     ctx = await get_global_playwright_context()
    #     pw = await ctx.__aenter__()
    #     ws_endpoint = await read_config('camoufox', 'server', 'ws-endpoint')
    #     browser: Browser = await pw.firefox.connect(ws_endpoint=ws_endpoint)
    #     browser_context = await browser.new_context()
    # else:
    gecko_profile_dir = await read_config_get_path('crawler', 'gecko', 'profile-dir-base')
    if mode.browser_data_dir_id is not None:
        user_data_dir = os.path.join(gecko_profile_dir,
                                     filename_slugify(mode.browser_data_dir_id, allow_unicode=True))
        logger.debug('user data dir at {}', user_data_dir)
    else:
        user_data_dir = None
        logger.debug('user data dir no use')
    firefox_user_prefs = {
        # https://www.reddit.com/r/firefox/comments/107fj69/how_can_i_disable_the_efficiency_mode_on_firefox/
        'dom.ipc.processPriorityManager.backgroundUsesEcoQoS': False
    }
    if launch_options.get('firefox_user_prefs') is not None:
        firefox_user_prefs.update(launch_options.pop('firefox_user_prefs'))
    logger.debug('firefox_user_prefs : {}', firefox_user_prefs)
    async_camoufox_launch_options = dict(
        persistent_context=True,
        firefox_user_prefs=firefox_user_prefs,
        **launch_options,
    )
    if user_data_dir is not None:
        async_camoufox_launch_options['user_data_dir'] = user_data_dir
    logger.debug('async_camoufox_launch_options is :\n{}', json.dumps(async_camoufox_launch_options, indent=2))
    browser_context: BrowserContext = await AsyncCamoufox(**async_camoufox_launch_options).__aenter__()
    browser: None = browser_context.browser
    # browser = browser_context.browser
    # if browser is None:
    #     raise ValueError('Why browser is None ?')
    logger.info('BrowserContext is {} , Browser is {}', browser_context, browser)
    return browser_context, browser


async def _should_not_timeout_async(*,
                                    func: Union[
                                        Callable[[Any], typing.Coroutine[Any, Any, T]],
                                        Callable[[], typing.Coroutine[Any, Any, T]]
                                    ],
                                    args: Optional[List[Any]] = None,
                                    kwargs: Optional[Dict[str, Any]] = None,
                                    timeout=5,
                                    none_on_timeout=False
                                    ) -> T:
    if args is None:
        args = []
    if kwargs is None:
        kwargs = dict()

    future = func(*args, **kwargs)
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except BaseException as err:
        if is_timeout_error(err):
            logger.warning('Why func {} timeout {}s ? args is {} , kwargs is {}',
                           func, timeout, args, kwargs)
            if none_on_timeout:
                return None
            return await _should_not_timeout_async(func=func, args=args, kwargs=kwargs, timeout=timeout,
                                                   none_on_timeout=none_on_timeout)
        else:
            raise


async def _should_not_timeout_sync(*,
                                   func: Union[
                                       Callable[[Any], T],
                                       Callable[[], T]
                                   ],
                                   args: Optional[List[Any]] = None,
                                   kwargs: Optional[Dict[str, Any]] = None,
                                   timeout=5,
                                   none_on_timeout=False) -> T:
    if args is None:
        args = []
    if kwargs is None:
        kwargs = dict()

    def run():
        return func(*args, **kwargs)

    future = asyncio.get_event_loop().run_in_executor(None, run)
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except BaseException as err:
        if is_timeout_error(err):
            logger.warning('Why func {} timeout {}s ? arg is {} , kwargs is {}',
                           func, timeout, args, kwargs)
            if none_on_timeout:
                return None
            return await _should_not_timeout_sync(func=func, args=args, kwargs=kwargs, timeout=timeout,
                                                  none_on_timeout=none_on_timeout)
        else:
            raise


async def response_to_dict(resp: Optional[playwright.async_api.Response]):
    if resp is None:
        return None

    return dict(
        url=url_parse_to_dict(resp.url),
        ok=await _should_not_timeout_sync(func=lambda: resp.ok),
        status=await _should_not_timeout_sync(func=lambda: resp.status),
        status_text=await _should_not_timeout_sync(func=lambda: resp.status_text),
        headers=await _should_not_timeout_sync(func=lambda: resp.headers),
        from_service_worker=await _should_not_timeout_sync(func=lambda: resp.from_service_worker),
        request=await _should_not_timeout_async(func=request_info_to_dict, args=[resp.request], timeout=20),
        all_headers=await _should_not_timeout_async(func=resp.all_headers),
        headers_array=await _should_not_timeout_async(func=resp.headers_array),
        server_addr=await _should_not_timeout_async(func=resp.server_addr),
        security_details=await _should_not_timeout_async(func=resp.security_details),
    )


async def request_info_to_dict(req: Optional[playwright.async_api.Request]):
    if req is None:
        return None
    return dict(
        url=await _should_not_timeout_sync(func=lambda: url_parse_to_dict(req.url)),
        resource_type=await _should_not_timeout_sync(func=lambda: req.resource_type),
        method=await _should_not_timeout_sync(func=lambda: req.method),
        post_data_buffer=await _should_not_timeout_sync(func=lambda: req.post_data_buffer),

        # 在知网爬虫中此步骤经常超时。
        redirected_from=await _should_not_timeout_async(func=request_info_to_dict,
                                                        args=[req.redirected_from],
                                                        timeout=10,
                                                        none_on_timeout=True),

        failure=await _should_not_timeout_sync(func=lambda: req.failure),
        timing=await _should_not_timeout_sync(func=lambda: req.timing),
        headers=await _should_not_timeout_sync(func=lambda: req.headers),

        # 在知网爬虫中此步骤偶尔超时。
        sizes=await _should_not_timeout_async(func=req.sizes,
                                              timeout=15,
                                              none_on_timeout=True),
        is_navigation_request=await _should_not_timeout_sync(func=lambda: req.is_navigation_request()),
        all_headers=await _should_not_timeout_async(func=req.all_headers),
        headers_array=await _should_not_timeout_async(func=req.headers_array),
    )


FrameTreeToDictResult = TypedDict('FrameTreeToDictResult', {
    'is_detached': bool,
    'python_id_of_this': int,
    'python_id_of_page': int,
    'python_id_of_parent_frame': int,
    'name': str,
    'url': Optional[ResultOfUrlParseToDict],
    'title': Optional[str],
    'content': Optional[MagicInfo],
    'child_frames': List['FrameTreeToDictResult'],
})


async def frame_tree_to_dict(frame: Frame,
                             *,
                             dump_page_ignore_names: Optional[str],
                             html2markdown_soup_find: Optional[str]) -> FrameTreeToDictResult:
    if frame.child_frames is None:
        child_frames: List[FrameTreeToDictResult] = []
    else:
        child_frames: List[FrameTreeToDictResult] = []
        for cf in frame.child_frames:
            child_frames.append(await frame_tree_to_dict(cf,
                                                         dump_page_ignore_names=dump_page_ignore_names,
                                                         html2markdown_soup_find=html2markdown_soup_find))
    from libiancrawlers.app_util.magic_util import get_magic_info
    is_detached = frame.is_detached()
    return {
        'is_detached': is_detached,
        'python_id_of_this': id(frame),
        'python_id_of_page': id(frame.page),
        'python_id_of_parent_frame': id(frame.parent_frame),
        'name': frame.name,
        'url': url_parse_to_dict(frame.url),
        'title': None if is_detached else await frame.title(),
        'content': None if is_detached else get_magic_info(await frame.content(),
                                                           dump_page_ignore_names=dump_page_ignore_names,
                                                           html2markdown_soup_find=html2markdown_soup_find),
        'child_frames': child_frames,
    }


@dataclass
class BlobOutput:
    mode: Literal['ignore', 'file', 'minio']
    base_dir: Optional[str]
    png_filename: Optional[str]
    pdf_filename: Optional[str]


ScreenShotResult = TypedDict('ScreenShotResult', {
    'png_pth': str,
    'pdf_pth': str,
    'png_err_str': Optional[str],
    'pdf_err_str': Optional[str],
    'png_size': int,
    'pdf_size': int,
})

MinIOObjectWriteResult = TypedDict('MinIOObjectWriteResult', {
    'bucket_name': Any,
    'object_name': Any,
    'version_id': Any,
    'etag': Any,
    'http_headers': Any,
    'last_modified': Any,
    'location': Any,
})

MinIOScreenShotResult = TypedDict('MinIOScreenShotResult', {
    'res_screenshot': ScreenShotResult,
    'res_obj_write': MinIOObjectWriteResult,
    'public_url': str,
})


async def _get_blob(*,
                    blob_output: Optional[BlobOutput],
                    get_screenshot: Callable[[], Awaitable[ScreenShotResult]],
                    ):
    if blob_output is None:
        return None
    if blob_output.mode == 'file':
        base_dir = blob_output.base_dir
        if base_dir is None or len(blob_output.base_dir) == 0:
            raise ValueError('require set base_dir on blob_output.mode==file')
        if not await aiofiles.ospath.isdir(base_dir):
            raise OSError(f'require isdir : {base_dir}')
        # noinspection PyArgumentList
        return await get_screenshot(
            output_base_dir=blob_output.base_dir,
            png_filename=blob_output.png_filename,
            pdf_filename=blob_output.pdf_filename,
        )
    if blob_output.mode == 'minio':
        endpoint = await read_config('crawler', 'minio', 'endpoint', allow_null=True)
        _client_config_secure = await read_config('crawler', 'minio', 'secure', allow_null=True)
        _client_config_cert_check = await read_config('crawler', 'minio', 'cert_check', allow_null=True)
        access_key = await read_config('crawler', 'minio', 'access_key', allow_null=True)
        secret_key = await read_config('crawler', 'minio', 'secret_key', allow_null=True)
        session_token = await read_config('crawler', 'minio', 'session_token', allow_null=True)
        region = await read_config('crawler', 'minio', 'region', allow_null=True)
        secure = True if _client_config_secure is None else is_config_truthy(_client_config_secure)
        cert_check = True if _client_config_cert_check is None else is_config_truthy(_client_config_cert_check)
        public_endpoint_url = await read_config('crawler', 'minio', 'public_endpoint_url', allow_null=True)
        if public_endpoint_url is None:
            public_endpoint_url = f'{"https://" if secure else "http://"}{endpoint}'

        from miniopy_async import Minio
        async with aiofiles.tempfile.TemporaryDirectory(
                suffix='-temp-screenshot',
                prefix='libiancrawler-',
                dir='.data') as temp_dir:
            png_file_name = 'screenshot.png'
            # noinspection PyArgumentList
            res_screenshot = await get_screenshot(
                output_base_dir=temp_dir,
                png_filename=png_file_name,
                pdf_filename='screenshot.pdf',
            )
            png_file_path = res_screenshot['png_pth']
            try:
                png_file_sha1 = await get_file_hash_sha1(png_file_path)
            except FileNotFoundError as err:
                logger.warning('screenshot file not found , maybe cause by screenshot failed . png_file_path is {}',
                               png_file_path)
                png_file_sha1 = None

            if png_file_sha1 is not None:
                client = Minio(endpoint=endpoint,
                               access_key=access_key,
                               secret_key=secret_key,
                               session_token=session_token,
                               region=region,
                               secure=secure,
                               cert_check=cert_check, )
                bucket_name = await read_config('crawler', 'minio', 'bucket_name', allow_null=True)
                if bucket_name is None:
                    bucket_name = 'libiancrawler'
                if not await client.bucket_exists(bucket_name):
                    await client.make_bucket(bucket_name)
                    logger.info('Create MinIO bucket {}', bucket_name)
                object_name = f'smart-crawl-screenshot/{datetime.today().strftime("%Y%m%d")}/{datetime.today().strftime("%H%M%S")}-sha1-{png_file_sha1}.png'
                logger.debug('put object to minio start  : bucket_name is {} , object_name is {} , file_path is {}',
                             bucket_name, object_name, png_file_path)
                res_obj_write = await client.fput_object(
                    bucket_name=bucket_name,
                    object_name=object_name,
                    file_path=png_file_path,
                    content_type='image/png',
                    metadata={
                        "Content-Type": "image/png"
                    },
                )
                from multidict import MultiDictProxy
                if isinstance(res_obj_write.http_headers, MultiDictProxy):
                    def _first_or_all(__items):
                        if isinstance(__items, list) or isinstance(__items, set) or isinstance(__items, tuple):
                            if len(__items) == 1:
                                return __items[0]
                            else:
                                return __items
                        else:
                            return __items

                    res_obj_write_http_headers = {k: _first_or_all(res_obj_write.http_headers.getall(k)) for k in
                                                  res_obj_write.http_headers.__iter__()}
                else:
                    res_obj_write_http_headers = res_obj_write.http_headers

                _res_obj_write: MinIOObjectWriteResult = {
                    'bucket_name': res_obj_write.bucket_name,
                    'object_name': res_obj_write.object_name,
                    'version_id': res_obj_write.version_id,
                    'etag': res_obj_write.etag,
                    'http_headers': res_obj_write_http_headers,
                    'last_modified': res_obj_write.last_modified,
                    'location': res_obj_write.location,
                }
                # assert it can be json dump
                assert json.dumps(_res_obj_write) is not None
                public_url = str.join('/', [
                    public_endpoint_url.rstrip('/'),
                    res_obj_write.bucket_name,
                    res_obj_write.object_name,
                ])
                logger.debug('put object to minio finish : result is {}', _res_obj_write)
                logger.debug('put object to minio public_url : \n{}', public_url)

        if png_file_sha1 is not None:
            _res_value: MinIOScreenShotResult = {
                'res_obj_write': _res_obj_write,
                'res_screenshot': res_screenshot,
                'public_url': public_url,
            }
            return _res_value
        else:
            return None
    return None


ResultOfPageInfoToDictVideo = TypedDict('ResultOfPageInfoToDictVideo', {
    'path': pathlib.Path,
})

ResultOfPageInfoToDict = TypedDict('ResultOfPageInfoToDict', {
    'url': Optional[ResultOfUrlParseToDict],
    'viewport_size': Optional[ViewportSize],
    'video': Optional[ResultOfPageInfoToDictVideo],
    'title': str,
    'is_closed': bool,
    'files': Union[None, ScreenShotResult, MinIOScreenShotResult]
})


async def page_info_to_dict(page: playwright.async_api.Page,
                            *,
                            on_screenshot: Optional[BlobOutput],
                            ) -> ResultOfPageInfoToDict:
    async def get_screenshot(*,
                             output_base_dir: str,
                             png_filename: str,
                             pdf_filename: str) -> ScreenShotResult:
        png_pth = os.path.join(output_base_dir, png_filename)
        logger.debug('start screenshot , png_pth is {}', png_pth)
        try:
            # noinspection PyUnusedLocal
            png_res = await page.screenshot(
                type='png',
                path=png_pth,
                full_page=True,
                scale='css',
            )
            png_err_str = None
        except BaseException as err:
            logger.warning('Cannot screenshot : {}', err)
            # noinspection PyUnusedLocal
            png_res = None
            png_err_str = str(err)
        finally:
            logger.debug('finish screenshot')
        pdf_pth = os.path.join(output_base_dir, pdf_filename)
        logger.debug('start pdf , pdf_pth is {}', pdf_pth)
        try:
            # noinspection PyUnusedLocal
            pdf_res = await page.pdf(path=pdf_pth)
            pdf_err_str = None
        except BaseException as err:
            if 'PDF generation is only supported for Headless Chromium' in str(err):
                logger.debug('Cannot pdf : {}', err)
            else:
                logger.warning('Cannot pdf : {}', err)
            # noinspection PyUnusedLocal
            pdf_res = None
            pdf_err_str = str(err)
        finally:
            logger.debug('finish pdf')
        return dict(
            png_pth=png_pth,
            pdf_pth=pdf_pth,
            png_err_str=png_err_str,
            pdf_err_str=pdf_err_str,
            png_size=0 if png_res is None else len(png_res),
            pdf_size=0 if pdf_res is None else len(pdf_res),
        )

    return dict(
        url=url_parse_to_dict(page.url),
        viewport_size=page.viewport_size,
        video=None if page.video is None else dict(
            path=await page.video.path()
        ),
        title=await page.title(),
        is_closed=page.is_closed(),
        files=await _get_blob(
            blob_output=on_screenshot,
            get_screenshot=get_screenshot,
        )
    )


if __name__ == '__main__':
    pass
