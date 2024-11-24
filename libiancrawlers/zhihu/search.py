# -*- coding: UTF-8 -*-
from typing import Union, Tuple, Literal, Optional

import json5
from loguru import logger

from libiancrawlers.common import sleep
from libiancrawlers.common.app_init import exit_app, init_app
from libiancrawlers.common.playwright_util import get_browser
from libiancrawlers.common.types import Initiator, LaunchBrowserParam
from libiancrawlers.zhihu import zhihu_check_login_state, zhihu_req_get


async def search(*,
                 keywords: Union[str, Tuple[str]],
                 page_max: Optional[int] = None,
                 page_size: Optional[int] = None,
                 fetch_all_content: bool = False,
                 fetch_all_comment: bool = False,
                 retry: int = 0,
                 sort: Literal['', 'upvoted_count', 'created_time'] = '',
                 search_time: Literal['', 'a_day', 'a_week', 'a_month', 'three_mouths', 'half_a_year', 'a_year'] = '',
                 note_type: Literal['', 'answer', 'article', 'zvideo'] = '',
                 raise_on_error_response: bool = True,
                 stop_until_page_close: bool = False,
                 ):
    from libiancrawlers.common import on_before_retry_default
    from libiancrawlers.common.search import SearchByKeywordContext, SearchByKeywordResult, abstract_search

    b_page = None

    try:
        logger.debug('start get browser')
        browser_context, _ = await get_browser(
            mode=LaunchBrowserParam(browser_data_dir_id='login-zhihu'),
            launch_options={
                'os': 'macos',
                'locale': 'zh-CN',
            }
        )
        logger.debug('finish get browser , start new page')
        b_page = await browser_context.new_page()
        logger.debug('finish new page')

        async def check_page_close():
            return not b_page.is_closed()

        async def on_init():
            already_goto_index = False
            while not await zhihu_check_login_state(browser_context=browser_context):
                logger.debug('cookies : {}', await b_page.context.cookies())
                logger.info('等待用户在浏览器登陆知乎...')
                if not already_goto_index:
                    await b_page.goto('https://www.zhihu.com', wait_until="domcontentloaded")
                    already_goto_index = True
                await sleep(20, checker=check_page_close)
            logger.debug('首页 cookies : {}', await b_page.context.cookies())
            logger.info('正在跳转到搜索页面获取Cookies...')
            await b_page.goto(
                'https://www.zhihu.com/search?q=python&search_source=Guess&utm_content=search_hot&type=content',
                wait_until="domcontentloaded")
            await sleep(5, checker=check_page_close)
            logger.debug('搜索页面 cookies : {}', await b_page.context.cookies())

        async def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
            keyword = c['keyword']
            page = c['page']
            _page_size = c['page_size']
            uri = '/api/v4/search_v3'
            params = {
                "gk_version": "gz-gaokao",
                "t": "general",
                "q": keyword,
                "correction": 1,
                "offset": (page - 1) * _page_size,
                "limit": _page_size,
                "filter_fields": "",
                "lc_idx": (page - 1) * _page_size,
                "show_all_topics": 0,
                "search_source": "Filter",
                "time_interval": search_time,
                "sort": sort,
                "vertical": note_type,
            }
            resp = await zhihu_req_get(b_page=b_page,
                                       uri=uri,
                                       params=params,
                                       referer='https://www.zhihu.com/search?q=python&time_interval=a_year&type=content')
            resp_text = await resp.text()
            try:
                j = json5.loads(resp_text, encoding='utf-8')
            except BaseException:
                j = None
                if raise_on_error_response:
                    logger.error('response not json: {}', resp_text)
                    raise

            if raise_on_error_response:
                if j is not None and 'error' in j:
                    raise ValueError('Failed response in zhihu search : %s' % (j,))

            return {
                'search_result': {
                    "j": j,
                    'resp': {
                        'code': resp.status,
                        'headers': resp.headers,
                        'text': resp_text
                    },
                    'params': params,
                    'raise_on_error_response': raise_on_error_response,
                },
                'has_more': j.get('numPages', 1) > page
            }

        await abstract_search(
            keywords=keywords,
            page_max=page_max,
            page_size=page_size,
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

        logger.info('OK')
    finally:
        if stop_until_page_close:
            logger.info('stop_until_page_close')
            while b_page is not None and not b_page.is_closed():
                await sleep(1)
        if _SHUTDOWN_AFTER_SEARCH:
            await exit_app()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    init_app(Initiator(postgres=True, playwright=True))
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
