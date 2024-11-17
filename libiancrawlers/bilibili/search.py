# -*- coding: UTF-8 -*-
import time
from typing import Union, Tuple

from libiancrawlers.common.search import SearchByKeywordContext, SearchByKeywordResult, abstract_search


def search(*,
           keywords: Union[str, Tuple[str]],
           fetch_all_content: bool = False,
           fetch_all_comment: bool = False,
           retry: int = 0,
           ):
    def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
        result = xhs_client.get_note_by_keyword(
            keyword=c.get('keyword'),
            page=c.get('page'),
            page_size=c.get('page_size'))
        return {
            'search_result': result,
            'has_more': result.get('has_more', False)
        }

    return abstract_search(
        keywords=keywords,
        fetch_all_content=fetch_all_content,
        fetch_all_comment=fetch_all_comment,
        retry=retry,
        platform_id='bilibili',
        crawler_tag='lib_bilibili-api-python',
        on_init=lambda: None,
        on_search_by_keyword=on_search_by_keyword,
        on_retry=lambda: time.sleep(60),
    )


def cli():
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
