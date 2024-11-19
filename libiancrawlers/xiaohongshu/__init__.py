# -*- coding: UTF-8 -*-
import threading
from typing import Dict, Any, NamedTuple, Optional, Callable, Awaitable
import json

import json5
from aioify import aioify
from curl_cffi import requests
from loguru import logger
from xhs import DataFetchError, XhsClient, IPBlockError, ErrorEnum
from xhs.exception import NeedVerifyError, SignError

from libiancrawlers.common import random_user_agent, read_config, is_config_truthy


def _sign(uri, data=None, a1="", web_session=""):
    res = requests.post(read_config('crawler', 'xiaohongshu', 'sign-server-path'),
                        json={"uri": uri, "data": data, "a1": a1, "web_session": web_session})
    signs = res.json()
    return {
        "x-s": signs["x-s"],
        "x-t": signs["x-t"]
    }


def concat_xhs_note_url(*, note_id, xsec_token):
    return f"https://www.xiaohongshu.com/discovery/item/{note_id}?source=webshare&xhsshare=pc_web&xsec_token={xsec_token}&xsec_source=pc_share"


class NoteNotExistOrFengKongException(Exception):
    pass


def _get_note_by_id_from_html(self, note_id: str, xsec_token: str):
    import re

    def camel_to_underscore(key):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", key).lower()

    def transform_json_keys(json_data) -> Dict[str, Any]:
        try:
            while '""""' in json_data:
                logger.warning('Fuck xhs dirty data')
                json_data = json_data.replace('""""', '""')
            data_dict = json5.loads(json_data)
            dict_new = {}
            for key, value in data_dict.items():
                new_key = camel_to_underscore(key)
                if not value:
                    dict_new[new_key] = value
                elif isinstance(value, dict):
                    dict_new[new_key] = transform_json_keys(json.dumps(value))
                elif isinstance(value, list):
                    dict_new[new_key] = [
                        transform_json_keys(json.dumps(item))
                        if (item and isinstance(item, dict))
                        else item
                        for item in value
                    ]
                else:
                    dict_new[new_key] = value
            return dict_new
        except BaseException:
            logger.error('Why json parse failed ? {}', json_data)
            raise

    url = concat_xhs_note_url(note_id=note_id, xsec_token=xsec_token)
    res = self.session.get(url, headers={"user-agent": self.user_agent, "referer": "https://www.xiaohongshu.com/"})
    html = res.text
    _find_all_res = re.findall(r"window.__INITIAL_STATE__=({.*})</script>", html)
    if len(_find_all_res) != 0:
        state = _find_all_res[0].replace("undefined", '""')
        if state != "{}":
            note_dict = transform_json_keys(state)
            if note_dict["note"]["first_note_id"] == '':
                # 帖子被删了，或账号被风控
                raise NoteNotExistOrFengKongException(
                    f"""note_dict["note"]["first_note_id"] == '' , note_id={note_id}""")

            if note_dict["note"]["first_note_id"] != note_id:
                logger.warning('Why note_dict["note"]["first_note_id"] != note_id ? note_id={} , note_dict={}',
                               note_id, note_dict)
            return note_dict["note"]["note_detail_map"][note_id]["note"]
        elif ErrorEnum.IP_BLOCK.value in html:
            raise IPBlockError(ErrorEnum.IP_BLOCK.value)
    raise DataFetchError(html)


def _request(self, method, url, **kwargs):
    logd = is_config_truthy(read_config('crawler', 'xiaohongshu', 'logd-request'))
    if logd:
        logger.debug('xhs request (self is {}) {} {} {}', self, method, url, kwargs)
    response = self.session.request(
        method, url, timeout=self.timeout, proxies=self.proxies, **kwargs
    )
    if not len(response.text):
        return response
    try:
        data = response.json()
    except json.decoder.JSONDecodeError:
        return response
    if logd:
        logger.debug('xhs response is {}, data is {}', response, data)
    if response.status_code == 471 or response.status_code == 461:
        # someday someone maybe will bypass captcha
        verify_type = response.headers['Verifytype']
        verify_uuid = response.headers['Verifyuuid']
        raise NeedVerifyError(
            f"出现验证码，请求失败，Verifytype: {verify_type}，Verifyuuid: {verify_uuid}",
            response=response, verify_type=verify_type, verify_uuid=verify_uuid)
    elif data.get("success"):
        return data.get("data", data.get("success"))
    elif data.get("code") == ErrorEnum.IP_BLOCK.value.code:
        raise IPBlockError(ErrorEnum.IP_BLOCK.value.msg, response=response)
    elif data.get("code") == ErrorEnum.SIGN_FAULT.value.code:
        raise SignError(ErrorEnum.SIGN_FAULT.value.msg, response=response)
    else:
        raise DataFetchError(data, response=response)


def create_xhs_client(*, cookie: str):
    XhsClient.get_note_by_id_from_html = _get_note_by_id_from_html
    XhsClient.request = _request
    xhs_client = XhsClient(cookie,
                           sign=_sign,
                           user_agent=random_user_agent()
                           )
    xhs_client.__session = requests.session.Session()
    logger.debug('create xhs client {}', xhs_client)
    return xhs_client


_GLOBAL_XHS_CLIENT = None
_GLOBAL_XHS_CLIENT_LOCK = threading.Lock()


def get_global_xhs_client():
    global _GLOBAL_XHS_CLIENT
    if _GLOBAL_XHS_CLIENT is None:
        with _GLOBAL_XHS_CLIENT_LOCK:
            if _GLOBAL_XHS_CLIENT is None:
                _cookie = read_config('crawler', 'xiaohongshu', 'cookie')
                _GLOBAL_XHS_CLIENT = create_xhs_client(cookie=_cookie)
    return _GLOBAL_XHS_CLIENT


aioget_global_xhs_client: Callable[[], Awaitable[XhsClient]] = aioify(obj=get_global_xhs_client)


class XHSNoteLink(NamedTuple):
    note_id: str
    xsec_token: str
    title: Optional[str]


if __name__ == '__main__':
    pass
