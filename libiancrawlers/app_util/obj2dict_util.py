from typing import Optional, TypedDict, List, Dict, Union, Tuple
from urllib.parse import urlparse, parse_qs

ResultOfUrlParseToDict = TypedDict('ResultOfUrlParseToDict', {
    'url': str,
    'url_len': int,
    'scheme': Optional[str],
    'netloc': Optional[str],
    'path': Optional[str],
    'path_arr': List[str],
    'path_arr_len': int,
    'params': Optional[str],
    'query': Optional[str],
    'query_dict': Dict[str, Optional[Union[str, List, Tuple]]],
    'fragment': Optional[str],
    'username': Optional[str],
    'password': Optional[str],
    'hostname': Optional[str],
    'port': Optional[int],
})


def url_parse_to_dict(url: Optional[str]) -> Optional[ResultOfUrlParseToDict]:
    if url is None:
        return None
    _url = urlparse(url)
    _res: ResultOfUrlParseToDict = dict(
        url=url,
        url_len=len(url),
        scheme=_url.scheme,
        netloc=_url.netloc,
        path=_url.path,
        path_arr=_url.path.split('/'),
        path_arr_len=len(_url.path.split('/')),
        params=_url.params,
        query=_url.query,
        query_dict={
            k: None if v is None or len(v) == 0 or (len(v) == 1 and v[0].strip() == '') else v[0] if len(v) == 1 else v
            for k, v in parse_qs(_url.query).items()},
        fragment=_url.fragment,
        username=_url.username,
        password=_url.password,
        hostname=_url.hostname,
        port=_url.port,
    )
    return _res
