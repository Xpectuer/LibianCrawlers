# -*- coding: UTF-8 -*-
import asyncio
import json
from typing import Callable, Awaitable, Dict, List, TypedDict

from aioify import aioify
from loguru import logger

ParseCsvResult = TypedDict('ParseCsvResult', {'rows': List[Dict[str, str]], 'prefix': str})


def parse_csv_sync(csv_file_pth: str) -> ParseCsvResult:
    import csv
    # python 标准库的 csv 报错: field larger than field limit (131072)
    csv.field_size_limit(100000000)
    # 如果前3行有 空行 或 被-号分隔 的行，会认为存在无效行。
    # 如果有无效行存在，会找到无效行之后的第一个有效行作为表头。
    def is_invalid(l: str):
        return l.replace('-', ' ').strip() == ''

    skip_line = 0
    _find_first_valid_line = False
    with open(csv_file_pth, mode='rt', encoding='utf-8') as csv_file:
        _line_num = 1
        while True:
            line = csv_file.readline()
            if is_invalid(line):
                _find_first_valid_line = True
            elif _find_first_valid_line:
                skip_line = _line_num - 1
                break
            elif _line_num > 3:
                break
            _line_num += 1

    rows: List[Dict[str, str]] = []
    prefix_lines = []
    with open(csv_file_pth, mode='rt', encoding='utf-8') as csv_file:
        for _ in range(0, skip_line):
            prefix_lines.append(csv_file.readline())
        csv_reader = csv.DictReader(csv_file)
        for row in csv_reader:
            rows.append(row)
    return {
        'rows': rows,
        'prefix': '\n'.join(prefix_lines)
    }


parse_csv: Callable[[str], Awaitable[ParseCsvResult]] = aioify(obj=parse_csv_sync)

if __name__ == '__main__':
    pass
