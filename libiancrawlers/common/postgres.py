# -*- coding: UTF-8 -*-
import json
import threading
from typing import Optional, TYPE_CHECKING, Union, Tuple

import psycopg2.pool
from datetime import datetime
from loguru import logger

from libiancrawlers.common import read_config
from libiancrawlers.common.types import JSON

_CHECKED_GARBAGE_TABLE_EXIST = False


def get_conn():
    logger.debug('Getting postgres connection ...')
    conn = psycopg2.connect(
        dbname=read_config("crawler", "postgres", "dbname"),
        user=read_config("crawler", "postgres", "user"),
        password=read_config("crawler", "postgres", "password"),
        host=read_config("crawler", "postgres", "host"),
        port=read_config("crawler", "postgres", "port"),
    )
    return conn


# noinspection SpellCheckingInspection
_INIT_TABLE_SQL = """
CREATE SCHEMA IF NOT EXISTS libian_crawler;

CREATE TABLE IF NOT EXISTS libian_crawler.garbage (
  g_id BIGSERIAL PRIMARY KEY,
  g_create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  g_type VARCHAR(100) NOT NULL,
  g_search_key VARCHAR(1024),
  g_content JSON NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_g_create_time ON libian_crawler.garbage(g_create_time);
CREATE INDEX IF NOT EXISTS idx_g_type ON libian_crawler.garbage(g_type);
CREATE INDEX IF NOT EXISTS idx_g_search_key ON libian_crawler.garbage(g_search_key);
"""
_INIT_TABLE = False
_INIT_TABLE_LOCK = threading.Lock()


def require_init_table():
    global _INIT_TABLE
    if not _INIT_TABLE:
        with _INIT_TABLE_LOCK:
            if not _INIT_TABLE:
                conn = get_conn()
                try:
                    cur = conn.cursor()
                    cur.execute(_INIT_TABLE_SQL)
                    conn.commit()
                    logger.debug('init table sql invoke success')
                finally:
                    conn.close()
                _INIT_TABLE = True


def insert_to_garbage_table(*,
                            g_type: str,
                            g_search_key: Optional[str] = None,
                            g_content: JSON,
                            ):
    require_init_table()

    conn = get_conn()
    content = None
    try:
        content = json.dumps(g_content, ensure_ascii=False)
        content = content.encode("utf-8", 'ignore').decode('utf-8')
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO libian_crawler.garbage ( g_type, g_search_key, g_content ) VALUES ( %s, %s, %s );',
            (g_type,
             g_search_key,
             content
             )
        )
        logger.debug('success insert to table')
        conn.commit()
    except BaseException:
        logger.error('Failed insert to garbage table .\n\ng_content is {}\n\ncontent is {}',
                     g_content, content)
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    pass
