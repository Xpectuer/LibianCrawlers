# -*- coding: UTF-8 -*-
import asyncio
import json
from typing import Optional

from asyncpg import Pool
from loguru import logger
import asyncpg
from libiancrawlers.common.app_init import get_app_init_conf
from libiancrawlers.common.config import read_config
from libiancrawlers.common.types import JSON, AppInitConfDisable

_CHECKED_GARBAGE_TABLE_EXIST = False

_INIT_POOL_LOCK = asyncio.Lock()
_POOL: Optional[Pool] = None


async def close_global_pg_pool():
    if _POOL is not None and not _POOL.is_closing():
        logger.debug('Start wait close global pg pool')
        await _POOL.close()
        logger.debug('Finish wait close global pg pool')
    else:
        logger.debug('Already shutdown global pg pool')


async def get_pool():
    dbname = read_config("crawler", "postgres", "dbname")
    user = read_config("crawler", "postgres", "user")
    password = read_config("crawler", "postgres", "password")
    host = read_config("crawler", "postgres", "host")
    port = read_config("crawler", "postgres", "port")
    # dsn = f'scheme=postgresql dbname={dbname} user={user} password={password} host={host} port={port}'

    global _POOL
    if _POOL is None:
        async with _INIT_POOL_LOCK:
            if _POOL is None:
                if not get_app_init_conf().postgres:
                    raise AppInitConfDisable('postgres')
                logger.debug('Create global pg pool')
                _POOL = await asyncpg.create_pool(
                    database=dbname,
                    user=user,
                    password=password,
                    host=host,
                    port=port,
                )
                logger.debug('success create global pg pool : {}', _POOL)
    return _POOL


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
_INIT_TABLE_LOCK = asyncio.Lock()


async def require_init_table():
    global _INIT_TABLE
    if not _INIT_TABLE:
        async with _INIT_TABLE_LOCK:
            if not _INIT_TABLE:
                pool = await get_pool()
                await pool.execute(query=_INIT_TABLE_SQL)
                logger.debug('init table sql invoke success')
                _INIT_TABLE = True


async def insert_to_garbage_table(*,
                                  g_type: str,
                                  g_search_key: Optional[str] = None,
                                  g_content: JSON,
                                  ):
    content = None
    await require_init_table()
    try:
        content = json.dumps(g_content, ensure_ascii=False)
        content = content.encode("utf-8", 'ignore').decode('utf-8')
        pool = await get_pool()
        logger.debug('start insert to table')
        await pool.execute(
            'INSERT INTO libian_crawler.garbage ( g_type, g_search_key, g_content ) VALUES ( $1, $2, $3 );',
            g_type, g_search_key,  content
        )
        logger.debug('success insert to table')
    except BaseException:
        logger.error('Failed insert to garbage table .\n\ng_content is {}\n\ncontent is {}',
                     g_content, content)
        raise


if __name__ == '__main__':
    pass
