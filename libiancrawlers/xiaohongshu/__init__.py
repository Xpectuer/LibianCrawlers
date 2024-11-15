# -*- coding: UTF-8 -*-


if __name__ == '__main__':
    pass

import json
from curl_cffi import requests

from xhs import DataFetchError, XhsClient, IPBlockError, ErrorEnum


def _sign(uri, data=None, a1="", web_session=""):
    # 填写自己的 flask 签名服务端口地址
    res = requests.post("https://xhs-api.tong-ju.top:8443/sign",
                        json={"uri": uri, "data": data, "a1": a1, "web_session": web_session})
    signs = res.json()
    return {
        "x-s": signs["x-s"],
        "x-t": signs["x-t"]
    }


def get_note_by_id_from_html(self, note_id: str, xsec_token: str):
    import re

    def camel_to_underscore(key):
        return re.sub(r"(?<!^)(?=[A-Z])", "_", key).lower()

    def transform_json_keys(json_data):
        try:
            data_dict = json.loads(json_data)
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
            # logger.error('Why json parse failed ? {}', json_data)
            raise

    url = "https://www.xiaohongshu.com/explore/" + note_id + '?xsec_token=' + xsec_token
    res = self.session.get(url, headers={"user-agent": self.user_agent, "referer": "https://www.xiaohongshu.com/"})
    html = res.text
    _find_all_res = re.findall(r"window.__INITIAL_STATE__=({.*})</script>", html)
    if len(_find_all_res) != 0:
        state = _find_all_res[0].replace("undefined", '""')
        if state != "{}":
            note_dict = transform_json_keys(state)
            return note_dict["note"]["note_detail_map"][note_id]["note"]
        elif ErrorEnum.IP_BLOCK.value in html:
            raise IPBlockError(ErrorEnum.IP_BLOCK.value)
    raise DataFetchError(html)


def create_xhs_client(*, cookie: str):
    XhsClient.get_note_by_id_from_html = get_note_by_id_from_html
    xhs_client = XhsClient(cookie, sign=_sign)
    xhs_client.__session = requests.session.Session()
    return xhs_client
