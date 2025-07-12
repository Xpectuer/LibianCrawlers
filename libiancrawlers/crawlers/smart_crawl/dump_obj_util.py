# -*- coding: UTF-8 -*-
import asyncio
import json
from typing import Callable, Awaitable, Dict, List, TypedDict, Literal, Optional, Any

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

ParseExcelSheetResult = TypedDict('ParseExcelSheetResult', {
    'sheet_name': str,
    'error_code': Literal['success', 'failed_parse', 'failed_to_df', 'failed_to_json'],
    'error_info': Optional[str],
    'records': Any,
})

ParseExcelResult = TypedDict('ParseExcelResult', {
    'sheet_names': List[str],
    'sheets': Dict[str, ParseExcelSheetResult],
})


def parse_excel_sync(excel_file_pth: str) -> ParseExcelResult:
    import pandas as pd

    xf = pd.ExcelFile(excel_file_pth)

    def map_sheet_name_to_result(sheet_name: str) -> ParseExcelSheetResult:
        try:
            logger.debug('start parse sheet {}', sheet_name)
            _parsed = xf.parse(sheet_name=sheet_name)
            logger.debug('success parse sheet {}', sheet_name)
        except BaseException as err:
            logger.warning('Failed to parse sheet {} : {}', sheet_name, err)
            return {
                'sheet_name': sheet_name,
                'error_code': 'failed_parse',
                'error_info': str(err),
                'records': None,
            }
        try:
            logger.debug('start parse sheet {} to data frame', sheet_name)
            df = pd.DataFrame(_parsed)
            logger.debug('success parse sheet {} to data frame:\n{}', sheet_name, df)
        except BaseException as err:
            logger.warning('Failed parse sheet {} to data frame : {}', sheet_name, err)
            return {
                'sheet_name': sheet_name,
                'error_code': 'failed_to_df',
                'error_info': str(err),
                'records': None,
            }
        try:
            logger.debug('start convert {} data frame to json', sheet_name)
            records = df.to_json(orient='records', lines=False, force_ascii=False)
            if records is None:
                raise ValueError('records is None')
            logger.debug('success convert {} data frame to json , string length is {}', sheet_name, len(records))
        except BaseException as err:
            logger.warning('Failed convert {} data frame to json : {}', sheet_name, err)
            return {
                'sheet_name': sheet_name,
                'error_code': 'failed_to_json',
                'error_info': str(err),
                'records': None,
            }
        return {
            'sheet_name': sheet_name,
            'error_code': 'success',
            'error_info': None,
            'records': json.loads(records),
        }

    sheets = {
        _sheet_name: map_sheet_name_to_result(_sheet_name) for _sheet_name in xf.sheet_names
    }

    # for sheet_name in xf.sheet_names:
    #     parsed = xf.parse(sheet_name=sheet_name)
    #     df = pd.DataFrame(parsed)
    #     df.to_json(orient='records', lines=True)

    return {
        'sheet_names': list(xf.sheet_names),
        'sheets': sheets,
    }


parse_excel: Callable[[str], Awaitable[ParseExcelResult]] = aioify(obj=parse_excel_sync)

if __name__ == '__main__':
    pass
