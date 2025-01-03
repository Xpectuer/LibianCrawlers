# -*- coding: UTF-8 -*-
import json
import re
from typing import Union, Callable, Any, Optional, TypedDict, List, Dict, Tuple

import charset_normalizer
import html_to_json
import json5
from magic import magic

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


AllCjkNodes = TypedDict('AllCjkNodes', {"value": Any, "ids": List[Union[str, int]], })
HtmlMagicExtractResult = TypedDict('HtmlMagicExtractResult', {"all_cjk_nodes": AllCjkNodes, })


def html_magic_extract(root: Any, *, detect_by_cjk: bool) -> Optional[HtmlMagicExtractResult]:
    if root is None:
        return None

    nodes = dict()
    all_cjk_nodes: Dict[str, AllCjkNodes] = dict()

    def ids_to_key(_ids: List[Union[str, int]]):
        return '___'.join([__id if isinstance(__id, str) else str(__id).rjust(4, '0') for __id in _ids])

    def has_cjk_char(s: str):
        if not detect_by_cjk:
            return False
        for _n in re.findall(r'[\u4e00-\u9fff]+', s):
            return True
        return False

    def travel(node: Any, ids: List[str]):
        if node is None:
            return
        nodes[ids_to_key(ids)] = node
        if isinstance(node, float) or isinstance(node, int):
            return
        if isinstance(node, bool):
            return
        if isinstance(node, str):
            if has_cjk_char(node):
                _key = ids_to_key(ids)
                all_cjk_nodes[_key] = {
                    'value': nodes[_key],
                    'ids': [*ids]
                }
                return
            return
        if isinstance(node, tuple) or isinstance(node, list) or isinstance(node, set):
            for idx, item in enumerate(node):
                travel(item, [*ids, idx])
            return
        if isinstance(node, dict):
            for k in node:
                if k == 'style' or k == 'script':
                    continue
                travel(node[k], [*ids, k])
            return

        raise ValueError(f'Invalid type in json node , type is {type(node)} , node is {node}')

    travel(root, [])

    # """
    # 当发现某一位置出现中日韩字符时，将会搜索其父路径上各个数组下标的”不同下标值的相同位置“是否存在类似的内容。
    # """
    # for cjk_node in all_cjk_nodes.values():
    #     _cjk_ids = cjk_node.get('ids')
    #     for idx_of_cjk in range(len(_cjk_ids) - 1, -1, -1):
    #         item_of_cjk = _cjk_ids[idx_of_cjk]
    #         if isinstance(item_of_cjk, int):
    #
    #             pass
    #         else:
    #             continue

    return {
        'all_cjk_nodes': all_cjk_nodes
    }


MagicInfo = TypedDict('MagicInfo', {
    "mime": str,
    "desc": str,
    "buf_type": str,
    "decoded": Optional[DecodeBytesResult],
    "str_encoded": Optional[EncodeStrWithoutEncoded],
    "value_json": Any,
    "value_json5": Any,
    "html_magic_extracted": Any,
    "value_html_to_json": Any,
    "text": Optional[str],
})


def get_magic_info(buf: Union[str, bytes], *, html_extract_detect_by_cjk: bool) -> MagicInfo:
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
            value_html_to_json = html_to_json.convert(text)
        else:
            value_html_to_json = None
    except BaseException:
        value_html_to_json = None

    html_magic_extracted = html_magic_extract(value_html_to_json, detect_by_cjk=html_extract_detect_by_cjk)

    def parse_json(t: str):
        try:
            j = json.loads(t)
        except Exception:
            j = None

        try:
            j5 = json5.loads(t)
        except ValueError:
            j5 = None

        return j, j5

    value_json, value_json5 = parse_json(text)
    if value_json is None and value_json5 is None:
        try:
            value_json, value_json5 = parse_json(value_html_to_json['html'][0]['body'][0]['pre'][0]['_value'])
        except BaseException:
            pass

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

    return dict(
        mime=mime,
        desc=desc,
        buf_type=f'{type(buf)}',
        decoded=_decoded,
        str_encoded=_str_encoded,
        value_json=value_json,
        value_json5=value_json5,
        html_magic_extracted=html_magic_extracted,
        value_html_to_json=value_html_to_json,
        text=None if value_html_to_json is not None else text
    )


if __name__ == '__main__':
    pass
