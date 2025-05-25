# -*- coding: UTF-8 -*-
import time
import calendar
from datetime import datetime, timedelta
from functools import wraps
from typing import TypeVar, Callable, Literal, Union, Tuple, List, Optional, Generator, Any

from loguru import logger
from typing_extensions import ParamSpec

from dateutil.relativedelta import relativedelta

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


Year = int
Mouth = Literal[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
Day = int
YMD = Tuple[Year, Mouth, Day]
YMDParam = Union[YMD, List[Union[Year, Mouth, Day]]]


def _parse_ymd(t: Union[Literal['now'], datetime, YMDParam]) -> YMD:
    _src_t = t
    if t == 'now':
        _now = datetime.now()
        # noinspection PyTypeChecker
        t = (_now.year, _now.month, _now.day)
    elif isinstance(t, str):
        t = list(map(int, t.split('-')))
    elif isinstance(t, datetime):
        t = t.year, t.month, t.day

    if len(t) != 3:
        raise ValueError(f'parse YMD failed , invalid param {_src_t}')

    if not isinstance(t[0], int) \
            or not isinstance(t[1], int) or t[1] < 1 or t[1] > 12 \
            or not isinstance(t[2], int) or t[2] < 1 or t[2] > calendar.monthrange(t[0], t[1])[1]:
        raise ValueError(f'parse YMD failed , invalid param {_src_t}')
    return t


def days_iter(*,
              start: Union[Literal['now'], YMDParam, str],
              offset_day: Union[int, str],
              stop_until: Union[int, YMDParam]) -> Generator[YMD, Any, None]:
    if not isinstance(offset_day, int):
        offset_day = int(offset_day)

    if offset_day == 0:
        raise ValueError('Invalid offset_month')
    t = _parse_ymd(start)
    count = 0

    def should_continue():
        if isinstance(stop_until, int):
            return count < stop_until
        else:
            stop_year, stop_month, stop_day = stop_until
            if offset_day > 0:
                return t[0] < stop_year \
                    or t[0] == stop_year and t[1] < stop_month \
                    or t[0] == stop_year and t[1] == stop_month and t[2] < stop_day
            else:
                return t[0] > stop_year \
                    or t[0] == stop_year and t[1] > stop_month \
                    or t[0] == stop_year and t[1] == stop_month and t[2] > stop_day

    while should_continue():
        _yield_t: YMD = t
        yield _yield_t
        count += 1
        ty, tm, td = t
        td = td + offset_day
        while td < 1:
            tm = tm - 1
            while tm < 1:
                tm = tm + 12
                ty = ty - 1
            td = td + calendar.monthrange(ty, tm)[1]
        while td > calendar.monthrange(ty, tm)[1]:
            td = td - calendar.monthrange(ty, tm)[1]
            tm = tm + 1
            while tm > 12:
                tm = tm - 12
                ty = ty + 1
        while tm > 12:
            tm = tm - 12
            ty = ty + 1
        while tm < 1:
            tm = tm + 12
            ty = ty - 1
        t = (ty, tm, td)


def days_ranges_iter(*,
                     start: Union[Literal['now'], YMDParam, str],
                     offset_day: Union[int, str],
                     stop_until: Union[int, YMDParam],
                     yield_stop_until_value_if_end_value_not_equal: bool,
                     end_offset: int,
                     ) -> Generator[Tuple[YMD, YMD], Any, None]:
    if not isinstance(offset_day, int):
        offset_day = int(offset_day)

    last_year: Optional[Year] = None
    last_mouth: Optional[Mouth] = None
    last_day: Optional[Day] = None

    def end_date_offset(y: int, m: int, d: int):
        t = datetime(year=y, month=m, day=d, hour=0, minute=0, second=0, microsecond=0)
        t = t + (1 if end_offset > 0 else -1) * timedelta(days=abs(end_offset))
        return t.year, t.month, t.day

    for year, month, day in days_iter(
            start=start, offset_day=offset_day, stop_until=stop_until
    ):
        if last_year is not None and last_mouth is not None and last_day is not None:
            if offset_day > 0:
                yield (last_year, last_mouth, last_day), end_date_offset(year, month, day)
            else:
                yield (year, month, day), end_date_offset(last_year, last_mouth, last_day)
        last_year = year
        last_mouth = month
        last_day = day

    if yield_stop_until_value_if_end_value_not_equal and not isinstance(stop_until, int):
        stop_year: Year = stop_until[0]
        stop_month: Mouth = stop_until[1]
        stop_day: Day = stop_until[2]
        if last_year is not None and last_mouth is not None and last_day is not None:
            if offset_day > 0:
                yield (last_year, last_mouth, last_day), end_date_offset(stop_year, stop_month, stop_day)
            else:
                yield (stop_year, stop_month, stop_day), end_date_offset(last_year, last_mouth, last_day)
        else:
            start_year, start_month, start_day = _parse_ymd(start)
            if offset_day > 0:
                if start_year < stop_year \
                        or start_year == stop_year and start_month < stop_month \
                        or start_year == stop_year and start_month == stop_month and start_day < stop_day:
                    yield (start_year, start_month, start_day), end_date_offset(stop_year, stop_month, stop_day)
            else:
                if start_year > stop_year \
                        or start_year == stop_year and start_month > stop_month \
                        or start_year == stop_year and start_month == stop_month and start_day > stop_day:
                    yield (stop_year, stop_month, stop_day), end_date_offset(start_year, start_month, start_day)


# def datetime_ranges(*,
#                     order: Literal['now_to_past'] = 'now_to_past',
#                     size_mouth: int = 5,
#                     interval_month: int = 1, ):
#     if order == 'now_to_past':
#         end = datetime.now()
#         stop = end
#         for i in range(0, size_mouth):
#             mouth_target = stop.month - 1
#             if mouth_target >= 12:
#                 raise ValueError('BUG')
#             if mouth_target >= 1:
#                 stop = end - relativedelta(month=mouth_target)
#             else:
#                 stop = end.replace(year=end.year - 1, month=12)
#         logger.debug(f'end is {end} , stop is {stop}')
#         # while end > stop:
#         #     start = end - relativedelta(month=interval_month)
#         #     logger.debug(f'start is {start}, end is {end}, stop is {stop}')
#         #     yield start, end
#         #     end = start
#     else:
#         raise ValueError(f'Invalid param `order` : {order}')


if __name__ == '__main__':
    pass
