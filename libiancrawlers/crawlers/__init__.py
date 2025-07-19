# -*- coding: UTF-8 -*-
from typing import Literal

CrawlMode = Literal[
    'insert_to_db',
    'save_file',
    'save_file_and_insert_to_db',
    'all',
]
_valid_crawl_mode = ['insert_to_db', 'save_file', 'save_file_and_insert_to_db']

the_default_crawl_mode__save_file = 'save_file'

def parse_mode(mode: CrawlMode):
    if mode == 'all':
        mode = 'save_file_and_insert_to_db'
    if mode not in _valid_crawl_mode:
        raise ValueError(f'Invalid mode {mode} , valid value should in {_valid_crawl_mode}')
    is_save_file = mode == 'save_file' or mode == 'save_file_and_insert_to_db'
    is_insert_to_db = mode == 'insert_to_db' or mode == 'save_file_and_insert_to_db'
    return is_save_file, is_insert_to_db


if __name__ == '__main__':
    pass
