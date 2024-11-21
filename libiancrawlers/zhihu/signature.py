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
import hashlib
import os

d_c0 = 'AMAW7Hf1ahaPTt3aKjIujKEgJpOWE1mpaZk=|1677915009'
version = '101_3_3.0'


def get_x_zse_96(path):
    import execjs

    signature = {
        'x-zse-93': version,
        'path': path,
        'd_c0': d_c0
    }
    val = '+'.join(signature.values())

    m = hashlib.md5()
    m.update(val.encode('utf-8'))

    # noinspection SpellCheckingInspection
    with open(os.path.join('libiancrawlers', 'zhihu', 'zhihuvmp.js'), mode='r+', encoding='utf-8') as f:
        js_str = f.read()
    ctx1 = execjs.compile(js_str)
    encrypt_str = ctx1.call('get_zse_96', m.hexdigest())
    return encrypt_str


if __name__ == '__main__':
    pass
