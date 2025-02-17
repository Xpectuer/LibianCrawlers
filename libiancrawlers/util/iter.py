# -*- coding: UTF-8 -*-
from typing import *

T = TypeVar('T')
R = TypeVar('R')


def filter_not_none(lst: Iterable[Optional[T]]) -> TypeGuard[List[T]]:
    res = []
    for item in lst:
        if item is not None:
            res.append(item)
    return res


def index_of(lst: List[T], item: T) -> int:
    """
    获取下标，不存在的话返回 -1 而不是抛出异常。
    """
    try:
        return lst.index(item)
    except ValueError:
        return -1


def map_item_to_runnable(lst: Iterable[T], cb: Callable[[T], R]) -> List[Callable[[], R]]:
    """
    这个函数的美妙之处在于 —— 它可以在闭包中保护循环变量不可变。
    """
    callbacks = []
    for item in lst:
        def cb_outer(_item=item):
            return cb(_item)

        callbacks.append(cb_outer)

    return callbacks


def lazy_variable(factory: Callable[[], T]):
    data: List[T] = []

    from threading import Lock
    from loguru import logger
    lock = Lock()

    from libiancrawlers.util.timefmt import logd_time

    @logd_time
    def get_variable():
        if len(data) == 0:
            with lock:
                if len(data) == 0:
                    logger.debug('[{}] Init lazy variable', factory.__name__)
                    data.append(factory())
        logger.debug('[{}] Use cached variable', factory.__name__)
        return data[0]

    return get_variable


def split_arr(lst: List[T], batch: int) -> List[List[T]]:
    _res_div, _res_mod = divmod(len(lst), batch)
    _batch_count = _res_div + (0 if _res_mod == 0 else 1)
    res: List[List[T]] = []
    for i in range(_batch_count):
        res.append(lst[
                   i * batch
                   :min((i + 1) * batch, len(lst))
                   ])
    return res


if __name__ == '__main__':
    pass
