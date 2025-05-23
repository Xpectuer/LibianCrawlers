# -*- coding: UTF-8 -*-
import json
from typing import Union, Callable, Any, Optional, TypedDict, List, Dict, TypeVar, Tuple

import charset_normalizer
import json5
from bs4 import BeautifulSoup, PageElement, Tag, NavigableString
from loguru import logger
import magic

from libiancrawlers.util.jsons import is_json_basic_type

T = TypeVar('T')


def parse_json(t: str):
    j_err = None
    try:
        j = json.loads(t)
    except Exception as err:
        j = None
        j_err = err

    j5_err = None
    try:
        j5 = json5.loads(t)
    except ValueError as err:
        j5 = None
        j5_err = err

    if j_err is not None and j5_err is not None:
        logger.debug('try parse json failed , text is {} , json err is {} , json5 err is {}',
                     f'{t[0:30]}... (len is {len(t)})' if len(t) > 30 else t,
                     j_err,
                     j5_err,
                     )

    return j, j5


CharsetMatchDict = TypedDict('CharsetMatchDict', {
    "multi_byte_usage": float,
    "encoding": str,
    "encoding_aliases": List[str],
    "bom": bool,
    "byte_order_mark": bool,
    "languages": List[str],
    "language": str,
    "chaos": float,
    "percent_chaos": float,
    "percent_coherence": float,
    "submatch": List['CharsetMatchDict'],
    "has_submatch": bool,
    "alphabets": List[str],
    "could_be_from_charset": List[str],
    "fingerprint": str,
})


def _charset_match_to_dict(cm: charset_normalizer.CharsetMatch) -> CharsetMatchDict:
    return dict(
        multi_byte_usage=cm.multi_byte_usage,
        encoding=cm.encoding,
        encoding_aliases=cm.encoding_aliases,
        bom=cm.bom,
        byte_order_mark=cm.byte_order_mark,
        languages=cm.languages,
        language=cm.language,
        chaos=cm.chaos,
        percent_chaos=cm.percent_chaos,
        percent_coherence=cm.percent_coherence,
        submatch=[_charset_match_to_dict(s) for s in cm.submatch],
        has_submatch=cm.has_submatch,
        alphabets=cm.alphabets,
        could_be_from_charset=cm.could_be_from_charset,
        fingerprint=cm.fingerprint,
    )


DecodeBytes = TypedDict('DecodeBytes', {"decoded": str, "encoding": str, "errors": str})


def _get_bytes_decode(buf: bytes, encoding: str, errors: str) -> DecodeBytes:
    return {
        "decoded": buf.decode(encoding, errors),
        "encoding": encoding,
        "errors": errors,
    }


EncodeStr = TypedDict('EncodeStr', {"encoded": bytes, "encoding": str, "errors": str})
EncodeStrWithoutEncoded = TypedDict('EncodeStrWithoutEncoded', {"encoding": str, "errors": str})


def _get_str_encode(s: str, encoding: str, errors: str) -> EncodeStr:
    return {
        "encoded": s.encode(encoding, errors),
        "encoding": encoding,
        "errors": errors,
    }


DecodeBytesResult = TypedDict('DecodeBytesResult',
                              {"bytes_decode": Optional[DecodeBytes],
                               "charset_matches_best": Optional[CharsetMatchDict],
                               "charset_matches": List[CharsetMatchDict]})


def _decode_bytes(_buf: bytes) -> DecodeBytesResult:
    _charset_matches = []
    __charset_matches = []
    charset_matches = charset_normalizer.from_bytes(_buf)
    for cm in charset_matches:
        __charset_matches.append(cm)
        _charset_matches.append(_charset_match_to_dict(cm))
    charset_matches_best = charset_matches.best()

    def try_decode_utf8(encoding: str, on_failed: Callable[[], Optional[DecodeBytes]]):
        try:
            return _get_bytes_decode(_buf, encoding, 'strict')
        except UnicodeDecodeError:
            try:
                return _get_bytes_decode(_buf, encoding, 'ignore')
            except UnicodeDecodeError:
                return on_failed()

    def _try_decode_not_utf_8():
        for _cm in __charset_matches:
            try:
                return _get_bytes_decode(_buf, _cm.encoding, 'strict')
            except Exception:
                try:
                    return _get_bytes_decode(_buf, _cm.encoding, 'ignore')
                except Exception:
                    continue
        return None

    return dict(
        bytes_decode=try_decode_utf8('utf-8', on_failed=lambda: _try_decode_not_utf_8()),
        charset_matches_best=None if charset_matches_best is None else _charset_match_to_dict(charset_matches_best),
        charset_matches=_charset_matches,
    )


ITag = TypedDict('ITag', {
    "bs4_type": str,
    "name": str,
    "attrs": Optional[Dict[str, Union[str, List[str]]]],
    "hidden": bool,
    'str': Optional[str],
    'children': Optional[List['IPageElement']]
})

Bs4ToDictConfig = TypedDict('Bs4ToDictConfig', {
    'dump_page_ignore_names': List[str],
})


def _bs4_tag_to_dict(t: Tag, *, children: bool, conf: Bs4ToDictConfig) -> ITag:
    n = t.name
    s = t.string

    skip_length_check = False

    def _name_exist():
        try:
            return conf.get('dump_page_ignore_names', []).index(n) >= 0
        except ValueError:
            return False

    __name_exist = _name_exist()

    if s is None:
        pass
    elif __name_exist:
        s = '__IGNORE__'
    elif n in ['pre', 'textarea']:
        j, j5 = parse_json(s.strip())
        if j is not None or j5 is not None:
            skip_length_check = True
    else:
        s = s.strip()

    # if not skip_length_check:
    #     str_max_length = ignore_conf.get('str_max_length')
    #     if s is not None and str_max_length is not None and 0 <= str_max_length < len(s):
    #         s = f'Ignore length greater than {str_max_length}'

    cld = None if __name_exist or not children else [
        _bs4_page_element_to_dict(c,
                                  children=children,
                                  conf=conf
                                  ) for c in t.children]

    if cld is not None and len(cld) == 1:
        c = [c for c in t.children][0]
        if isinstance(c, NavigableString) and str(c) == t.string:
            cld = []

    if cld is None or len(cld) == 0:
        cld = None

    return {
        'bs4_type': str(type(t)),
        'name': n,
        'attrs': t.attrs,
        'hidden': t.hidden,
        'str': s,
        'children': cld,
    }


INavigableString = TypedDict('INavigableString', {
    "bs4_type": str,
    'str': str,
})


def _bs4_navigable_string_to_dict(s: NavigableString) -> INavigableString:
    return {
        'bs4_type': str(type(s)),
        'str': str(s),
    }


IPageElementUnknownType = TypedDict('IPageElementUnknownType', {
    "bs4_type": str,
})

IPageElement = Union[ITag, INavigableString, IPageElementUnknownType]


def _bs4_page_element_to_dict(p: PageElement, *, children: bool, conf: Bs4ToDictConfig) -> IPageElement:
    if isinstance(p, Tag):
        return _bs4_tag_to_dict(p, children=children, conf=conf)
    if isinstance(p, NavigableString):
        return _bs4_navigable_string_to_dict(p)
    d = p.__dict__
    r: IPageElementUnknownType = {
        'bs4_type': str(type(p)),
        **{
            k: d[k] for k in d if is_json_basic_type(d[k])
        }
    }
    return r


ParseHtmlInfoResult = TypedDict('ParseHtmlInfoResult', {
    "title": Optional[ITag],
    "root": Optional[ITag],
})


def parse_html_info(html_doc: Optional[str], *, conf: Optional[Bs4ToDictConfig] = None) \
        -> Optional[ParseHtmlInfoResult]:
    if html_doc is None:
        return None
    if conf is None:
        conf: Bs4ToDictConfig = {
            'dump_page_ignore_names': []
        }
    soup = BeautifulSoup(html_doc, 'html.parser')
    _title = soup.__getattr__('title')
    r: ParseHtmlInfoResult = {
        'title': None if _title is None else _bs4_tag_to_dict(_title,
                                                              children=True,
                                                              conf=conf),
        'root': _bs4_tag_to_dict(soup,
                                 children=True,
                                 conf=conf),
    }

    return r


MagicInfo = TypedDict('MagicInfo', {
    "mime": str,
    "desc": str,
    "buf_type": str,
    "decoded": Optional[DecodeBytesResult],
    "str_encoded": Optional[EncodeStrWithoutEncoded],
    "value_json": Any,
    "value_json5": Any,
    "html_info": Optional[ParseHtmlInfoResult],
    "text": Optional[str],
})


def find_tag(t: Optional[ITag], names: List[str], prop: Optional[str]):
    if t is None:
        return None
    n = t.get('name')
    if n == names[0]:
        # noinspection PyTypedDict
        # return t[prop] if prop is not None else t
        if len(names) >= 2:
            cld = t.get('children')
            if cld is None or not isinstance(cld, list) or len(cld) <= 0:
                return None
            for c in cld:
                r = find_tag(c, names[1:len(names)], prop)
                if r is not None:
                    return r
        else:
            # noinspection PyTypedDict
            return t[prop] if prop is not None else t
    return None


def get_magic_info(buf: Union[str, bytes],
                   *,
                   dump_page_ignore_names: Optional[Union[str, Tuple[str]]],
                   ) -> MagicInfo:
    mime = magic.from_buffer(buffer=buf, mime=True)
    desc = magic.from_buffer(buffer=buf, mime=False)

    if isinstance(buf, bytes):
        str_encoded = None
        decoded = _decode_bytes(buf)
    elif isinstance(buf, str):
        try:
            str_encoded = _get_str_encode(buf, 'utf-8', 'strict')
        except UnicodeEncodeError:
            str_encoded = _get_str_encode(buf, 'utf-8', 'ignore')
        decoded = _decode_bytes(str_encoded.get('encoded'))
    else:
        raise ValueError(f'should pass bytes or str , but {type(buf)}')

    bytes_decode = decoded.get('bytes_decode')
    if bytes_decode is not None:
        text = bytes_decode.get('decoded', '')
    else:
        text = ''

    try:
        if text.strip().startswith('<'):
            if dump_page_ignore_names is None:
                _dump_page_ignore_names = []
            elif isinstance(dump_page_ignore_names, str):
                _dump_page_ignore_names = [item.strip() for item in dump_page_ignore_names.split(',')]
            else:
                _dump_page_ignore_names = [item.strip() for item in dump_page_ignore_names]
            html_info = parse_html_info(text, conf={
                'dump_page_ignore_names': _dump_page_ignore_names
            })
        else:
            html_info = None
    except BaseException as err:
        logger.debug('parse html failed : {}', err)
        html_info = None

    value_json, value_json5 = parse_json(text)
    if value_json is None and value_json5 is None:
        try:
            if html_info is not None:
                firefox_plain_text_tag = find_tag(html_info.get('root'), ['[document]', 'html', 'body', 'pre'], 'str')
                logger.debug('try find firefox plain text tag in html , result is {}', firefox_plain_text_tag)
                value_json, value_json5 = parse_json(firefox_plain_text_tag)
        except BaseException as err:
            logger.debug('parse json and json5 from html.body.pre failed : {}', err)

    # noinspection PyTypeChecker
    _decoded: Optional[DecodeBytesResult] = None if decoded is None else dict(
        bytes_decode=None if decoded.get('bytes_decode') is None else
        dict(
            encoding=decoded.get('bytes_decode').get('encoding'),
            errors=decoded.get('bytes_decode').get('errors'),
            decoded=None if text is not None and text != '' else decoded.get('bytes_decode').get('decoded')),
        charset_matches_best=decoded.get('charset_matches_best'),
        charset_matches=decoded.get('charset_matches')
    )

    # noinspection PyTypeChecker
    _str_encoded: Optional[EncodeStrWithoutEncoded] = None if str_encoded is None else {
        "encoding": str_encoded['encoding'],
        "errors": str_encoded['errors'],
    }

    if value_json is not None:
        logger.debug('result value json is {}', value_json)
    elif value_json5 is not None:
        logger.debug('result value json5 is {}', value_json5)

    return dict(
        mime=mime,
        desc=desc,
        buf_type=f'{type(buf)}',
        decoded=_decoded,
        str_encoded=_str_encoded,
        value_json=value_json,
        value_json5=value_json5,
        html_info=html_info,
        text=None if html_info is not None else text
    )


if __name__ == '__main__':
    pass
