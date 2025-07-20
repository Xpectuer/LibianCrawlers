from types import MappingProxyType
from typing import Optional, TypedDict, List, Dict, Union, Tuple, TYPE_CHECKING, AnyStr, Any
from urllib.parse import urlparse, parse_qs

import aiohttp
import yarl
from aiohttp import ClientResponse
from multidict import MultiMapping

if TYPE_CHECKING:
    from aiohttp.client_reqrep import ContentDisposition
    from aiohttp.connector import Connection
else:
    ContentDisposition = Any
    Connection = Any

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


def url_yarl_obj_to_dict(url: Optional[yarl.URL]):
    if url is None:
        return None
    return dict(
        to_str=url.__str__(),
        to_str_to_dict=url_parse_to_dict(url.__str__()),
        port=url.port,
        scheme=url.scheme,
        password=url.password,
        path=url.path,
        name=url.name,
        fragment=url.fragment,
        host=url.host,
        query=multi_map_to_dict(url.query),
        query_string=url.query_string,
        is_absolute=url.is_absolute(),
        is_default_port=url.is_default_port(),
    )


def multi_map_to_dict(m: Optional[Union[MultiMapping, MappingProxyType[str, str]]]):
    if m is None:
        return None
    res = dict()
    for k in m.keys():
        try:
            v = m.getall(k)
        except BaseException:
            v = m.get(k)
        if isinstance(v, list) or isinstance(v, tuple) and len(v) == 1:
            v = v[0]
        res[k] = v
    return res


def aiohttp_request_info_to_dict(request_info: Optional[aiohttp.RequestInfo]):
    if request_info is None:
        return None
    return dict(
        url=url_yarl_obj_to_dict(request_info.url),
        real_url=url_yarl_obj_to_dict(request_info.real_url),
        method=request_info.method,
        headers=multi_map_to_dict(request_info.headers),
    )


def aiohttp_content_disposition_to_dict(c: Optional[ContentDisposition]):
    if c is None:
        return None
    return dict(
        _type=c.type,
        parameters=multi_map_to_dict(c.parameters),
        filename=c.filename,
    )


def aiohttp_connection_to_str(c: Optional[Connection]):
    if c is None:
        return None
    return c.__repr__()


def aiohttp_resp_to_dict(resp: Optional[ClientResponse]):
    if resp is None:
        return None
    return dict(
        url=url_yarl_obj_to_dict(resp.url),
        real_url=url_yarl_obj_to_dict(resp.real_url),
        ok=resp.ok,
        method=resp.method,
        host=resp.host,
        status=resp.status,
        headers=multi_map_to_dict(resp.headers),
        request_info=aiohttp_request_info_to_dict(resp.request_info),
        content_disposition=aiohttp_content_disposition_to_dict(resp.content_disposition),
        connection=aiohttp_connection_to_str(resp.connection),
        closed=resp.closed,
        encoding=resp.get_encoding(),
        content_type=resp.content_type,
        charset=resp.charset,
        content_length=resp.content_length,
        version=resp.version,

        # from_service_worker=await _should_not_timeout_sync(func=lambda: resp.from_service_worker),
        # request=await _should_not_timeout_async(func=request_info_to_dict, args=[resp.request], timeout=20),
        # all_headers=await _should_not_timeout_async(func=resp.all_headers),
        # headers_array=await _should_not_timeout_async(func=resp.headers_array),
        # server_addr=await _should_not_timeout_async(func=resp.server_addr),
        # security_details=await _should_not_timeout_async(func=resp.security_details),
    )
