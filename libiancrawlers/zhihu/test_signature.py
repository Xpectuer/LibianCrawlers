# -*- coding: UTF-8 -*-
from loguru import logger

from libiancrawlers.zhihu.signature import get_x_zse_96


def test_get_x_zse_96():
    res = get_x_zse_96(
        '/api/v4/comment_v5/answers/2997437272/root_comment?limit=10&offset=568157402_10538825519_0&order_by=score')
    logger.debug('Test get_x_zse_96 result is {}', res)


if __name__ == '__main__':
    pass
