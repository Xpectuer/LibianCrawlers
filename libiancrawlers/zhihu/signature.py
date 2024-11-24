# -*- coding: UTF-8 -*-

"""
Copy from :
https://github.com/tiam-bloom/zhihuQuestionAnswer/blob/main/signature.py
"""

# @Time : 2024/3/15 22:32
# @Auther : Tiam
# @File : signature
# @Project : 20240315-python知乎回答评论抓取
# @Desc :
import os
from typing import Dict
from loguru import logger
import execjs

d_c0 = 'AMAW7Hf1ahaPTt3aKjIujKEgJpOWE1mpaZk=|1677915009'
version = '101_3_3.0'

ZHIHUVMP_JS = None


def get_sign(url: str, cookies: str) -> Dict:
    global ZHIHUVMP_JS
    if ZHIHUVMP_JS is None:
        with open(os.path.join('libiancrawlers', 'zhihu', 'zhihuvmp.js'), mode='r', encoding='utf-8') as f:
            _js_text = f.read()
        ZHIHUVMP_JS = execjs.compile(_js_text)
    res = ZHIHUVMP_JS.call('get_sign', url, cookies)
    # logger.debug('sign result :\n\nurl={}\n\ncookies={}\n\nres={}', url, cookies, res)
    return res


if __name__ == '__main__':
    pass
