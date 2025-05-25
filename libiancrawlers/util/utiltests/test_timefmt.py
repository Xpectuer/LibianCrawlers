# -*- coding: UTF-8 -*-
from libiancrawlers.util.timefmt import days_iter, days_ranges_iter
from datetime import datetime


def test_days_iter_now():
    count = 0
    for day in days_iter(start='now', offset_day=1, stop_until=10):
        print(day)
        count += 1
    assert count == 10
    print('--------------------------------------------')
    count = 0
    for day in days_iter(start='now', offset_day=1, stop_until=90):
        print(day)
        count += 1
    assert count == 90
    print('--------------------------------------------')
    count = 0
    for day in days_iter(start='now', offset_day=-1, stop_until=90):
        print(day)
        count += 1
    assert count == 90


def test_days_iter_2():
    for day in days_iter(start=(2025, 1, 1), offset_day=-2, stop_until=5):
        print(day)
    print('---------------')
    for day in days_iter(start=(2024, 12, 23), offset_day=2, stop_until=5):
        print(day)
    print('---------------')
    for day in days_iter(start=(2024, 12, 29), offset_day=2, stop_until=5):
        print(day)
    print('---------------')
    for day in days_iter(start=(2024, 12, 29), offset_day=2, stop_until=(2025, 1, 10)):
        print(day)


def test_days_ranges_iter():
    for rag in days_ranges_iter(start=(2024, 1, 1),
                                offset_day=1,
                                stop_until=(2024, 1, 12),
                                yield_stop_until_value_if_end_value_not_equal=True,
                                end_offset=0):
        print(rag)
    print('------------')
    for rag in days_ranges_iter(start=(2024, 1, 1),
                                offset_day=5,
                                stop_until=(2024, 1, 12),
                                yield_stop_until_value_if_end_value_not_equal=False,
                                end_offset=1):
        print(rag)
    print('------------')
    for rag in days_ranges_iter(start=(2024, 1, 1),
                                offset_day=5,
                                stop_until=(2024, 1, 12),
                                yield_stop_until_value_if_end_value_not_equal=True,
                                end_offset=2):
        print(rag)


if __name__ == '__main__':
    pass
