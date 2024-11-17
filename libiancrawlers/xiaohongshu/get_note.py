# -*- coding: UTF-8 -*-
import json
import time
from typing import Literal

from xhs import DataFetchError

from libiancrawlers.common.postgres import require_init_table, insert_to_garbage_table
from loguru import logger

from libiancrawlers.xiaohongshu import get_global_xhs_client, concat_xhs_note_url, create_xhs_client
from ratelimit import limits, sleep_and_retry
from backoff import on_exception, expo


@on_exception(expo, DataFetchError, max_tries=3)
@sleep_and_retry
@limits(calls=1, period=30)
def get_note(*,
             note_id: str,
             xsec_token: str,
             fetch_all_comment: bool,
             guess_title: str = '',
             detail_logd: bool = True,
             crawl_content_on_login=False):
    try:
        xhs_client = get_global_xhs_client()
        require_init_table()

        logger.debug('Start crawling note {}\n{}',
                     guess_title, concat_xhs_note_url(note_id=note_id, xsec_token=xsec_token))
        if crawl_content_on_login:
            logger.warning('Crawl content with login state maybe cause account BAN')
            note = xhs_client.get_note_by_id_from_html(note_id, xsec_token)
        else:
            logger.debug('Crawl content without login state .')
            note = create_xhs_client(cookie='').get_note_by_id_from_html(note_id, xsec_token)
        insert_to_garbage_table(
            g_type='xiaohongshu_note',
            g_content=dict(
                note=note,
                note_id=note_id,
                xsec_token=xsec_token,
            ),
        )
        if detail_logd:
            logger.debug('Crawled note note_id={} : {}', note_id, json.dumps(note, indent=2, ensure_ascii=False))

        def get_note_all_comments(crawl_interval=2):
            result = []
            comments_has_more = True
            comments_cursor = ""
            while comments_has_more:
                comments_res = xhs_client.get_note_comments(note_id, comments_cursor)
                comments_has_more = comments_res.get("has_more", False)
                comments_cursor = comments_res.get("cursor", "")
                comments = comments_res["comments"]
                for comment in comments:
                    result.append(comment)
                    cur_sub_comment_count = int(comment["sub_comment_count"])
                    cur_sub_comments = comment["sub_comments"]
                    result.extend(cur_sub_comments)
                    sub_comments_has_more = comment["sub_comment_has_more"] and len(
                        cur_sub_comments) < cur_sub_comment_count
                    sub_comment_cursor = comment["sub_comment_cursor"]
                    while sub_comments_has_more:
                        page_num = 30
                        sub_comments_res = xhs_client.get_note_sub_comments(
                            note_id, comment["id"], num=page_num, cursor=sub_comment_cursor
                        )
                        sub_comments = sub_comments_res["comments"]
                        sub_comments_has_more = sub_comments_res["has_more"] and len(sub_comments) == page_num
                        sub_comment_cursor = sub_comments_res["cursor"]
                        result.extend(sub_comments)
                        time.sleep(crawl_interval)
                logger.debug('... comments count {}', len(result))
                time.sleep(crawl_interval)
            return result

        if fetch_all_comment:
            logger.debug('Start crawling note all comments')
            all_comments = get_note_all_comments()
            insert_to_garbage_table(
                g_type='xiaohongshu_note_all_comments',
                g_content=dict(
                    all_comments=all_comments,
                    note=note,
                    note_id=note_id,
                    xsec_token=xsec_token,
                ),
            )
            if detail_logd:
                logger.debug('Crawled note all comments note_id={} : {}', note_id,
                             json.dumps(all_comments, indent=2, ensure_ascii=False))

        logger.debug('Finish crawl note')
    except BaseException as e:
        logger.warning('Some wrong on get note : {}', str(e))
        raise


def cli():
    from fire import Fire
    Fire(get_note)


if __name__ == '__main__':
    pass
