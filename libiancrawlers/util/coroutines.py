# -*- coding: UTF-8 -*-
import asyncio
import functools
from threading import Condition
from datetime import datetime
from typing import TypeVar, Any, Coroutine, Callable, Optional, Awaitable, List
from typing_extensions import ParamSpec
from loguru import logger

T = TypeVar('T')
P = ParamSpec("P")
R = TypeVar('R', covariant=True)


# noinspection PyUnusedLocal
def blocking_func(
        disk_accessing_using_blocking_apis: bool = False,
        network_accessing_using_blocking_apis: bool = False,
        subprocess_communicate: bool = False,
        calculation_very_time_consuming: bool = False,
        maybe_hooked_by_other_processes_and_wait: bool = False,
        disable_log_debug: bool = False
):
    """
    将一个函数表示为阻塞式API。

    但似乎类型标注有点问题。
    比如，如果在函数体内的闭包上定义，返回值会变Any。
    以及 pycharm 的参数类型校验似乎无效了，所以现在先不要在 参数多于一个 的函数上作为装饰器使用……

    :param disk_accessing_using_blocking_apis: 是否使用了访问磁盘的阻塞式API。
    :param network_accessing_using_blocking_apis: 是否使用了访问网络的阻塞式API。
    :param subprocess_communicate: 是否调用了 shell 并阻塞等待。
    :param calculation_very_time_consuming: 是否需要计算很长时间。
    :param maybe_hooked_by_other_processes_and_wait: 是否可能被别的进程 HOOK 而暂停。
    :param disable_log_debug: 是否打印日志。
    :return:
    """

    def deco(func: Callable[P, R]) -> Callable[P, Coroutine[Any, Any, R]]:
        @functools.wraps(func)
        async def inner(*args: P.args, **kwargs: P.kwargs) -> Coroutine[Any, Any, R]:
            start_at = datetime.now().timestamp() if not disable_log_debug else None
            if not disable_log_debug:
                logger.debug('🚴‍♂️⏸️[{}] Start blocking func ', func.__name__)
            try:
                return await asyncio.to_thread(func, *args, **kwargs)
            finally:
                if not disable_log_debug:
                    cast_time = datetime.now().timestamp() - start_at
                    logger.debug('🚴‍♂️⏹️[{}] {}{:.6f}s  >>> args={} , kwargs={}',
                                 func.__name__,
                                 "⏱️" if cast_time >= 5 else '🚀',
                                 cast_time,
                                 args,
                                 kwargs)

        return inner

    return deco


async def sleep(total: float, *, interval: float = 0.5, checker: Optional[Callable[[], Awaitable[bool]]] = None):
    start = datetime.utcnow().timestamp()
    end = start + total
    now = start
    while now < end:
        if checker is not None:
            if not await checker():
                return False
        now = datetime.utcnow().timestamp()
        await asyncio.sleep(min(interval, end - now))
        now = datetime.utcnow().timestamp()
    return True


# async def promise_any(promises: List[Awaitable[T]]):
#     return await asyncio.gather(*promises)

class CountDownLaunch:
    def __init__(self, count: int):
        self._count = count
        self._condition = Condition()

    def wait_sync(self, timeout: Optional[float] = None):
        start = datetime.utcnow().timestamp()
        self._condition.acquire()
        try:
            while True:
                if timeout is not None and timeout > 0 and datetime.utcnow().timestamp() > start + timeout:
                    return False
                if self._count > 0:
                    self._condition.wait(timeout=timeout / 10.0 if timeout is not None else None)  # wakeup by notifyAll
                if self._count <= 0:
                    return True
        finally:
            self._condition.release()

    async def wait_async(self, loop: asyncio.AbstractEventLoop, timeout: Optional[float] = None):
        return await loop.run_in_executor(None, self.wait_sync, timeout)

    def count_down_sync(self):
        self._condition.acquire()
        try:
            self._count -= 1
            self._condition.notify_all()
        finally:
            self._condition.release()

    async def count_down_async(self, loop: asyncio.AbstractEventLoop):
        return await loop.run_in_executor(None, self.count_down_sync)


if __name__ == '__main__':
    pass
