# -*- coding: UTF-8 -*-
import time
from functools import wraps
from typing import TypeVar, Callable

from loguru import logger
from typing_extensions import ParamSpec

P = ParamSpec("P")
R = TypeVar('R', covariant=True)


def logd_time(func: Callable[P, R]):
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs):
        start_at = time.time()
        result = None
        try:
            logger.debug('⏲️⏸️[{}] Start calc time', func.__name__)
            result = func(*args, **kwargs)
            return result
        finally:
            logger.debug('⏲️⏹️[{}] Cast time {:.6f}s . result is {}', func.__name__, time.time() - start_at, result)

    return wrapper


if __name__ == '__main__':
    pass
