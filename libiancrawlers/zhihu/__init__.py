# -*- coding: UTF-8 -*-
import json
import re
from typing import Dict, Optional
from urllib.parse import urlencode

from loguru import logger
from playwright.async_api import Page, Browser, BrowserContext

from libiancrawlers.common.types import TODO

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


async def zhihu_login():
    pass


async def zhihu_req_get(*, pr_page: Page, uri: str, params: Optional[Dict[str, str]]):
    url = 'https://www.zhihu.com' + uri
    # resp = await pr_page.request.get(url,
    #                                  params=params,
    #                                  headers=)

    pass


if __name__ == '__main__':
    pass
