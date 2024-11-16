# -*- coding: UTF-8 -*-
import threading
from typing import Optional, TYPE_CHECKING

import psycopg2.pool
from datetime import datetime
from loguru import logger

from libiancrawlers.common import read_config

if TYPE_CHECKING:
    from libiancrawlers.common.types import JSON

_CACHED_PG_CLIENT = None
_PG_CLIENT_INIT_LOCK = threading.Lock()
_CHECKED_GARBAGE_TABLE_EXIST = False


def get_pg_client():
    global _CACHED_PG_CLIENT
    if _CACHED_PG_CLIENT is None:
        with _PG_CLIENT_INIT_LOCK:
            if _CACHED_PG_CLIENT is None:
                logger.info('Start init postgres client ...')
                client = psycopg2.connect(
                    database=read_config("crawler", "postgres", "database"),
                    user="postgres",
                    password="secret",
                )
                logger.info('Finish init postgres client {}', )
                _CACHED_PG_CLIENT = None
    return _CACHED_PG_CLIENT


def insert_to_garbage_table(*,
                            i_type: str,
                            i_content: JSON,
                            i_crawler_create_time: Optional[datetime] = None,
                            ):
    if i_crawler_create_time is None:
        i_crawler_create_time = datetime.now()
    


if __name__ == '__main__':
    pass
