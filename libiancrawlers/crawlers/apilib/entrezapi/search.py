# -*- coding: UTF-8 -*-
import asyncio
import json
from typing import Union, Tuple, Optional, Literal, Dict, Generator, Any

from loguru import logger

from Bio import Entrez

from libiancrawlers.app_util.apicrawler_util.search import ApiCrawlMode
from libiancrawlers.app_util.types import Initiator
from libiancrawlers.app_util.app_init import exit_app, init_app


async def search(*,
                 mode: ApiCrawlMode = "save_file",
                 keywords: Union[str, Tuple[str]],
                 output_dir: Optional[str] = None,
                 db: str = 'pubmed',
                 page_max: int,
                 datetype: Optional[Literal['mdat', 'pdat', 'edat']] = None,
                 reldate: Optional[int] = None,
                 mindate: Optional[str] = None,
                 maxdate: Optional[str] = None,
                 email: Optional[str] = None,
                 retry: int = 0,
                 ):
    """
    Param see:

    https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
    """

    from libiancrawlers.app_util.apicrawler_util import on_before_retry_default
    from libiancrawlers.app_util.apicrawler_util.search import SearchByKeywordContext, SearchByKeywordResult, \
        abstract_search

    loop = asyncio.get_event_loop()

    if page_max < 0:
        page_max = None

    def efetch_list(*, kwd: str):
        search_params = {
            'db': db,
            'term': kwd,
        }
        if page_max is not None:
            search_params['retmax'] = page_max
        if datetype is not None:
            search_params['datetype'] = datetype
        if reldate is not None:
            search_params['reldate'] = reldate
        if mindate is not None:
            search_params['mindate'] = mindate
        if maxdate is not None:
            search_params['maxdate'] = maxdate
        esearch_handle = Entrez.esearch(**search_params)
        try:
            record = Entrez.read(esearch_handle)
            logger.debug('record is : {}', json.dumps(record, ensure_ascii=False, indent=2))
        finally:
            esearch_handle.close()
        rid_list = record['IdList']
        if not isinstance(rid_list, list) and not isinstance(rid_list, tuple):
            raise ValueError(f'rid_list should be list or tuple , but rid_list is {rid_list} , record is {record}')
        for idx in range(0, rid_list.__len__()):
            rid = rid_list[idx]
            efetch_handle = Entrez.efetch(db=db, id=rid, rettype='medline', retmode='text')
            try:
                yield rid, efetch_handle.read(), idx < rid_list.__len__() - 1
            finally:
                efetch_handle.close()

    efetch_list_iter_dict: Dict[str, Generator[tuple[Any, Any, bool], Any, Any]] = dict()

    old_email = Entrez.email
    try:
        if email is not None:
            Entrez.email = email

        async def on_search_by_keyword(c: SearchByKeywordContext) -> SearchByKeywordResult:
            keyword = c.get('keyword')
            if keyword not in efetch_list_iter_dict.keys():
                efetch_list_iter_dict[keyword] = efetch_list(kwd=keyword)

            def _get_next():
                return efetch_list_iter_dict[keyword].__next__()

            result = await loop.run_in_executor(None, _get_next)

            return {
                'search_result': {
                    "obj": {
                        'rid': result[0],
                        'obj': result[1],
                    },
                },
                'has_more': result[2]
            }

        async def on_init():
            pass

        await abstract_search(
            mode=mode,
            keywords=keywords,
            output_dir=output_dir,
            page_max=page_max,
            page_size=None,
            page_size_ignore=True,
            fetch_all_content=False,
            fetch_all_comment=False,
            retry_max=retry,
            platform_id='entrez',
            crawler_tag='lib_biopython',
            on_init=on_init,
            on_search_by_keyword=on_search_by_keyword,
            on_before_retry=on_before_retry_default,
        )
    finally:
        if email is not None:
            Entrez.email = old_email

        for _iter in efetch_list_iter_dict.values():
            _iter.close()

        if _SHUTDOWN_AFTER_SEARCH:
            await exit_app()


_SHUTDOWN_AFTER_SEARCH = False


def cli():
    init_app(Initiator(postgres=True, playwright=False))
    global _SHUTDOWN_AFTER_SEARCH
    _SHUTDOWN_AFTER_SEARCH = True
    from fire import Fire
    Fire(search)


if __name__ == '__main__':
    pass
