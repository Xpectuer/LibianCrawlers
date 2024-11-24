# -*- coding: UTF-8 -*-
import asyncio
import json
import re
from typing import Dict, Optional, Tuple
from urllib.parse import urlencode

from curl_cffi import requests
from curl_cffi.requests import Response
from loguru import logger
from playwright.async_api import Page, BrowserContext

from libiancrawlers.zhihu.signature import get_sign

_check_login_exp = re.compile(r'<pre>([\s\S]*?)</pre>')


async def zhihu_check_login_state(*, browser_context: BrowserContext) -> bool:
    logger.debug('Start check zhihu login state')
    # return False

    p = await browser_context.new_page()
    try:
        await p.goto('https://www.zhihu.com/api/v4/me', wait_until='domcontentloaded')
        html = await p.content()
        logger.debug('check zhihu login state content : {}', html)
    finally:
        await p.close()
    res = _check_login_exp.findall(html)
    logger.debug('match result : {}', res)
    if len(res) == 0:  # is None:
        raise ValueError('Not match regexp %s from response: %s' % (_check_login_exp, html))
    json_str = res[0]
    obj = json.loads(json_str)
    if 'error' in obj and obj['error']['code'] == 100:
        logger.debug('zhihu not login')
        return False
    if 'id' in obj:
        logger.debug('zhihu already login')
        return True
    raise ValueError('Unrecognized response : %s' % html)


async def zhihu_req_get(*, b_page: Page, uri: str, params: Optional[Dict[str, str]], referer: str):
    user_agent = await b_page.evaluate('navigator.userAgent')
    uri_with_params = uri if params is None else uri + '?' + urlencode(params)
    cookies = str.join(';', [f"{c['name']}={c['value']}" for c in await b_page.context.cookies()])

    return await b_page.context.request.get(
        url='https://www.zhihu.com' + uri_with_params,
        headers={
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cookie': cookies,
            'Priority': 'u=1, i',
            'Referer': referer,
            'User-Agent': user_agent,
            'x-api-version': '3.0.91',
            'x-app-za': 'OS=Web',
            'x-requested-with': 'fetch',
            'x-zse-93': '101_3_3.0',
            **get_sign(
                uri_with_params,
                cookies=cookies
            )
        }
    )

    # logger.debug('zhihu GET {} called . cookies={} , params={}', uri, cookies, params)

    # def _req_get_sync() -> Tuple[Response, str]:
    #     url = 'https://www.zhihu.com' + uri_with_params
    #     headers = {
    #         'Accept': '*/*',
    #         'Accept-Language': 'zh-CN,zh;q=0.9',
    #         'Cookie': cookies,
    #         'Priority': 'u=1, i',
    #         'Referer': referer,
    #         'User-Agent': user_agent,
    #         'x-api-version': '3.0.91',
    #         'x-app-za': 'OS=Web',
    #         'x-requested-with': 'fetch',
    #         'x-zse-93': '101_3_3.0',
    #         **get_sign(
    #             uri_with_params,
    #             cookies=cookies
    #         )
    #     }
    #     logger.debug('url={} , headers={}', url, headers)
    #     resp: Response = requests.get(
    #         url=url,
    #         headers=headers,
    #         impersonate="firefox132"
    #     )
    #     return resp, resp.text

    # return await asyncio.get_event_loop().run_in_executor(None, _req_get_sync)


if __name__ == '__main__':
    pass
