# -*- coding: UTF-8 -*-
import asyncio
import os.path
from typing import Union, Tuple

from loguru import logger

from libiancrawlers.common import exit_app, read_config_get_path, sleep
from libiancrawlers.common.playwright_util import get_browser
from libiancrawlers.common.types import TODO, Initiator, LaunchBrowserParam
from libiancrawlers.zhihu import zhihu_check_login_state


async def search(*,
                 keywords: Union[str, Tuple[str]],
                 # search_type: str,
                 fetch_all_content: bool = False,
                 fetch_all_comment: bool = False,
                 retry: int = 0,
                 ):
    from libiancrawlers.common import on_before_retry_default
    from libiancrawlers.common.postgres import close_global_pg_pool
    from libiancrawlers.common.search import SearchByKeywordContext, SearchByKeywordResult, abstract_search

    # search_type_allow = [e.value for e in SearchObjectType]
    # if search_type not in search_type_allow:
    #     raise ValueError('search_type should be : %s' % (search_type_allow,))

    try:
        browser_context, _ = await get_browser(mode=LaunchBrowserParam(browser_data_dir_id='login-zhihu'))
        b_page = await browser_context.new_page()

        async def check_page_close():
            return not b_page.is_closed()

        # storage_state_dir = await get_path_from_config('crawler', 'platform', 'zhihu', 'storage-state-dir',
        #                                                create_if_not_exist=True)
        # storage_state = await pr_page.context.storage_state(
        #     path=os.path.join(storage_state_dir, 'cookies.json'))

        # logger.debug('storage_state is {}', storage_state)

        async def on_init():
            # await pr_page.context.add_cookies(storage_state['cookies'])
            already_goto_index = False
            while not await zhihu_check_login_state(browser_context=browser_context):
                logger.info('等待用户在浏览器登陆知乎...')
                if not already_goto_index:
                    await b_page.goto('https://www.zhihu.com', wait_until="domcontentloaded")
                    _current_cookies = await b_page.context.cookies()
                    logger.debug('current cookies : {}', _current_cookies)
                    # storage_state['cookies'] = _current_cookies

                    already_goto_index = True
                b_page.is_closed()
                await sleep(20, checker=check_page_close)
            if not already_goto_index:
                await b_page.goto('https://www.zhihu.com', wait_until="domcontentloaded")

        async def search_async(*, keyword, page):
            raise TODO()
            # return await search_by_type(
            #     keyword=keyword,
            #     page=page,
            #     search_type=SearchObjectType(search_type),
            #     debug_param_func=lambda it: logger.debug('Debug in bilibili_api.search.search_by_type : {}', it)
            # )

        # search_sync = async_to_sync.function(search_async)

        async def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
            page = c.get('page')
            result = await search_async(
                keyword=c.get('keyword'),
                page=page,
            )

            return {
                'search_result': {
                    # "search_type": search_type,
                    "obj": result,
                },
                'has_more': result.get('numPages', 1) > page
            }

        await abstract_search(
            keywords=keywords,
            fetch_all_content=fetch_all_content,
            fetch_all_comment=fetch_all_comment,
            retry_max=retry,
            platform_id='zhihu',
            crawler_tag='zhihuvmp_zse_96',
            on_init=on_init,
            on_search_by_keyword=on_search_by_keyword,
            on_before_retry=on_before_retry_default,
            page_size_ignore=False
        )
    finally:
        if _SHUTDOWN_AFTER_SEARCH:
            await exit_app()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    from libiancrawlers.common import init_app
    init_app(Initiator(postgres=True, playwright=True))
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
