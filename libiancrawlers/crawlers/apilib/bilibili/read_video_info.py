# -*- coding: UTF-8 -*-
import base64
import json
from multiprocessing.pool import Pool
from pathlib import Path
from typing import *

import bilibili_api
from bilibili_api.utils.network import Api
from loguru import logger
from ratelimit import limits, sleep_and_retry

from libiancrawlers.app_util.apicrawler_util import log_debug_which_object_maybe_very_length
from libiancrawlers.app_util.apicrawler_util.rollup_store import RollupStore
from libiancrawlers.app_util.postgres import insert_to_garbage_table
from libiancrawlers.crawlers.apilib.bilibili.credential_store import latest_bilibili_credential
from libiancrawlers.crawlers.apilib.bilibili.init_fingerprint import init_fingerprint
from libiancrawlers.util.coroutines import sleep
from libiancrawlers.util.plat import PreventTheScreenSaver

_subprocess_pool: Optional[Pool] = None


async def read_video_info(*,
                          bvid: str,
                          use_cache: bool = True,
                          expire_time: Optional[float] = None,
                          is_insert_to_db: bool = False,
                          ):
    logger.debug('_FROM_CLI is : {}', _FROM_CLI)
    logger.debug('local is : {}', locals())

    if bvid.startswith('BV'):
        aid = bilibili_api.bvid2aid(bvid)
    elif bvid.startswith('av'):
        aid = int(bvid[len('av'):])
        bvid = bilibili_api.aid2bvid(aid)
    else:
        raise ValueError('Invalid bvid or avid : {}', bvid)
    logger.debug('start read video info , bvid is {} , aid is {}', bvid, aid)

    if _FROM_CLI:
        from libiancrawlers.app_util.app_init import init_app, Initiator

        init_app(Initiator(postgres=is_insert_to_db, playwright=False))

    if expire_time is None:
        expire_time = 15 * 24 * 60 * 60
    _cache_value = None
    bvid_dir_name = base64.b32encode(bvid.encode(encoding='utf-8')).decode(encoding='utf-8')
    logger.debug('[mainproc bvid={}] bvid_dir_name is {}, use_cache is {}', bvid, bvid_dir_name, use_cache)
    cache_dir = Path('.data') / 'apilib' / 'bilibili_api_python' / 'video_cache' / 'bvid_b32' / bvid_dir_name
    logger.debug('[mainproc bvid={}] cache_dir is {}', bvid, cache_dir)
    store = RollupStore(name=f'video_{bvid}',
                        desc=f'BiliBili视频 [{bvid}](https://www.bilibili.com/video/{bvid}) 的信息缓存。',
                        store_dir=cache_dir,
                        value_checker=None, )
    try:
        if use_cache:
            logger.debug('[mainproc bvid={}] store init start', bvid)
            await store.init()
            logger.debug('[mainproc bvid={}] store init finish , read latest start', bvid)
            _cache_value = await store.read_latest(expire_time=expire_time)
            logger.debug('[mainproc bvid={}] read latest finish', bvid)
        if _cache_value is not None:
            log_debug_which_object_maybe_very_length(prefix=f'[mainproc bvid={bvid}] Found cache',
                                                     obj=_cache_value,
                                                     max_output_length=200)
            return _cache_value if not _FROM_CLI else None
        value = await read_video_info_value(bvid=bvid)
        log_debug_which_object_maybe_very_length(prefix=f'[mainproc bvid={bvid}] Read video info',
                                                 obj=value,
                                                 max_output_length=200)
        if use_cache:
            logger.debug('[mainproc bvid={bvid}] store update lastest start')
            await store.update_latest(value=value)
            logger.debug('[mainproc bvid={bvid}] store update lastest finish')
        _output = dict(
            g_type=f'bilibili_api_python_video_v2',
            g_content=dict(
                result=value,
                platform_id='bilibili_api_python',
            ),
            g_search_key=None,
        )
        if is_insert_to_db:
            logger.debug('[mainproc bvid={bvid}] insert to db start')
            await insert_to_garbage_table(**_output)
            logger.debug('[mainproc bvid={bvid}] insert to db finish')
        else:
            logger.debug('[mainproc bvid={bvid}] not insert to db')
        return value if not _FROM_CLI else None
    finally:
        if _FROM_CLI:
            from libiancrawlers.app_util.app_init import exit_app

            await exit_app()


async def read_video_info_value(*, bvid: str):
    import asyncio

    def read_video_info_inner_sync(the_kwarg):
        global _subprocess_pool

        if _subprocess_pool is None:
            _subprocess_pool = Pool(processes=4)

        return _subprocess_pool.apply(func=_read_video_info_when_subproc,
                                      kwds=the_kwarg)

    async def query(*, is_login: bool, only_query_login_api_cid_list: Optional[List[str]] = None):
        return await asyncio.get_running_loop().run_in_executor(
            None,
            read_video_info_inner_sync,
            {
                'bvid': bvid,
                'is_login': is_login,
                'only_query_login_api_cid_list': only_query_login_api_cid_list,
            }
        )

    no_login_res = await query(is_login=False)
    logger.debug('no_login_res : type is {}', type(no_login_res))
    cid_list = [page['cid'] for page in no_login_res['video_cid_pages']]
    login_res = await query(is_login=True, only_query_login_api_cid_list=cid_list)
    return {
        'no_login_res': no_login_res,
        'login_res': login_res,
    }


def _read_video_info_when_subproc(*,
                                  bvid: str,
                                  is_login: bool,
                                  only_query_login_api_cid_list: Optional[List[str]] = None):
    is_login_tag = 'is_login' if is_login else 'no_login'
    logger.debug('[{} bvid={}] Start _read_video_info_when_subproc , is_login is {}', is_login_tag, bvid, is_login)

    import asyncio

    only_query_login_api = is_login and only_query_login_api_cid_list is not None and only_query_login_api_cid_list.__len__() > 0
    logger.debug('[{} bvid={}] only_query_login_api is {}', is_login_tag, bvid, only_query_login_api)

    async def _read_video_info():
        await init_fingerprint(use_proxy=False if is_login else True)

        from bilibili_api import video

        if is_login:
            # noinspection SpellCheckingInspection
            credential = await latest_bilibili_credential()
            if credential is None:
                raise Exception('not found bilibili credential')
        else:
            credential = None
        v = video.Video(bvid=bvid, credential=credential)

        async def get_public_notes_list_wrap():
            notes = []
            for i in range(0, 1000):
                ps = 10
                pn = i + 1
                logger.debug('[{} bvid={}] call get_public_notes_list(pn={}, ps={})', is_login_tag, bvid,
                             pn, ps)
                _notes = await v.get_public_notes_list(pn, ps)
                logger.debug('_notes is {}', _notes)
                if _notes['list'] is None or len(_notes['list']) <= 0:
                    break
                notes.append({
                    'notes': _notes,
                    'pn': pn,
                    'ps': ps,
                })
                await sleep(1)
            return notes

        if not only_query_login_api:
            v_attrs = [
                v.get_info,
                v.get_detail,
                v.get_up_mid,
                v.get_chargers,
                v.get_relation,
                v.get_pay_coins,
                v.is_forbid_note,
                v.get_danmaku_snapshot,
                v.is_episode,
            ]
        else:
            v_attrs = [
                get_public_notes_list_wrap,
            ]

        @sleep_and_retry
        @limits(calls=30 if not is_login else 6, period=3)
        async def _read_attr(attr: Callable[[], Awaitable[Any]], *, log_tag: str = '') -> Tuple[str, Any]:
            name: str = attr.__name__
            if name.startswith('get_'):
                name = name[len('get_'):]
            try:
                res_log = ''
                try:
                    r = await attr()
                    if isinstance(r, str) or isinstance(r, int) or isinstance(r, float) or isinstance(r,
                                                                                                      bool) or r is None:
                        res_log = json.dumps(r)
                    elif isinstance(r, dict) or isinstance(r, list) or isinstance(r, tuple) or isinstance(r, set):
                        res_log = log_debug_which_object_maybe_very_length(prefix='', obj=r, max_output_length=100,
                                                                           ret_str=True)
                    return name, r
                except bilibili_api.exceptions.ResponseCodeException as err:
                    if err.code == 62001:
                        logger.exception('api error on read attr {}', name)
                        return name, {
                            '__ERROR__': {
                                'err_type': str(type(err).__name__),
                                'code': err.code,
                                'msg': err.msg,
                                'args': err.args,
                                'raw': err.raw,
                            }
                        }
                    else:
                        raise
                finally:
                    logger.debug('[{} bvid={}{}] call {}{}', is_login_tag, bvid, f' {log_tag}' if log_tag else '',
                                 attr.__name__, f' >>> {res_log}' if res_log else '')
            except BaseException as err:
                if isinstance(err, bilibili_api.exceptions.CredentialNoSessdataException) \
                        or isinstance(err, bilibili_api.exceptions.ResponseCodeException) and err.code == -101:
                    if is_login:
                        raise ValueError(f'is_login is {is_login} but no sessdata') from err
                    else:
                        return name, '__NO_LOGIN__'
                raise ValueError(f'Error on read attr {name}') from err

        res = dict()
        res['video_info'] = {
            entry[0]: entry[1] for entry in await asyncio.gather(
                *[_read_attr(attr) for attr in v_attrs]
            )
        }

        async def _fetch_page(page):
            if 'cid' not in page:
                raise ValueError('not found cid')
            cid = page['cid']

            def wrap_func(func):
                def f2():
                    return func(cid=cid)

                _f2 = f2
                _f2.__name__ = func.__name__
                return _f2

            if not only_query_login_api:
                async def get_video_snapshot_wrap(cid):
                    return await v.get_video_snapshot(cid=cid, json_index=True, pvideo=False)

                cid_attrs = [
                    wrap_func(func) for func in [
                        v.get_tags,
                        get_video_snapshot_wrap,
                        v.get_download_url,
                        v.get_ai_conclusion,
                        v.get_subtitle,
                        v.get_pbp,
                    ]
                ]
            else:
                # noinspection PyShadowingNames
                async def get_subtitle_wrap(*, cid):
                    subtitle = await v.get_subtitle(cid=cid)
                    downloaded = [
                        await Api(url=f'https:{subtitle_item["subtitle_url"]}', method="GET").request(raw=True) \
                        for subtitle_item in subtitle['subtitles']]
                    return {
                        "subtitle": subtitle,
                        'downloaded': downloaded,
                    }

                cid_attrs = [
                    wrap_func(func) for func in [
                        v.get_ai_conclusion,
                        get_subtitle_wrap,
                    ]
                ]
            page_res = dict()
            page_res['cid'] = cid
            page_res['page'] = page
            page_res['attrs'] = {
                entry[0]: entry[1] for entry in await asyncio.gather(
                    *[_read_attr(attr, log_tag=f'cid={cid}') for attr in cid_attrs]
                )
            }
            return page_res

        if not only_query_login_api:
            res['video_cid_pages'] = await asyncio.gather(
                *[_fetch_page(page) for page in (await _read_attr(v.get_pages))[1]]
            )
        else:
            res['video_cid_pages_only_query_login_api'] = await asyncio.gather(
                *[_fetch_page(page) for page in (await _read_attr(v.get_pages))[1]]
            )

        logger.debug('[{} bvid={}] finish call apis', is_login_tag, bvid)
        return res

    return asyncio.get_event_loop().run_until_complete(_read_video_info())


_FROM_CLI = False


def cli():
    global _FROM_CLI
    _FROM_CLI = True

    with PreventTheScreenSaver():
        from fire import Fire
        Fire(read_video_info)


if __name__ == '__main__':
    pass
