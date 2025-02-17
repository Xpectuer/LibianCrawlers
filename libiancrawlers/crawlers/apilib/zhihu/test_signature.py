# -*- coding: UTF-8 -*-
from libiancrawlers.zhihu import get_sign
from loguru import logger


def test_sign():
    for url, cookies, res in [
        (
                '/api/v4/me?include=email%2Cis_active%2Cis_bind_phone'
                ,
                "_zap=ea5d604f-bc9e-4270-bf6f-4fba1b4a53cc;HMACCOUNT_BFESS=D1254182CA16064E;d_c0=ATCSHbj8OxmPTrRSnKZxrjZwkDh33UfHcPc=|1726302401;__snaker__id=9itjCJbxvIRtKpOf;q_c1=2b26643ef8f34e78829b7919ec735702|1726302413000|1726302413000;BAIDUID_BFESS=5B09A0CFC3F82E1F77A1317C06B799C8:FG=1;z_c0=2|1:0|10:1732455169|4:z_c0|80:MS4xOWc1RUVBQUFBQUFtQUFBQVlBSlZUUUY1TUdpemtYdGVDNjNZM3ZLMS1XY0RlMVJYTlZ2Z1ZnPT0=|ae51878bb0c2bb3f7494093913c27815f1985d9def8a32a186b9a63ca47d616f;__zse_ck=003_bqjyB3HX9LE8dVZmojSbMBFPZanFjtrRxywEXkokHNzejeyw57Z2+4XUPwST=ZL3BsipK+OxsdIZGwIR7dLnJoSL/XvV2gigmVxzF+vS+Q1T;BEC=684e706569bf16169217bb2a788786f3;BEC=1d78a1ec103a43b0d2c4340657960c71;_xsrf=40ac5e20-2f94-4ab6-8fa8-2a65b6258955;Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1732456788,1732462514,1732462579,1732462606;Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1732462606;HMACCOUNT=D1254182CA16064E;tst=r;BEC=92a0fca0e2e4d1109c446d0a990ad863"
                ,
                {
                    'x-zst-81': '3_2.0aR_sn77yn6O92wOB8hPZnQr0EMYxc4f18wNBUgpTQ6nxERFZfTY0-4Lm-h3_tufIwJS8gcxTgJS_AuPZNcXCTwxI78YxEM20s4PGDwN8gGcYAupMWufIoLVqr4gxrRPOI0cY7HL8qun9g93mFukyigcmebS_FwOYPRP0E4rZUrN9DDom3hnynAUMnAVPF_PhaueTFH9fQL39OCCqYTxfb0rfi9wfPhSM6vxGDJo_rBHpQGNmBBLqPJHK2_w8C9eTVMO9Z9NOrMtfhGH_DgpM-BNM1DOxScLG3gg1Hre1FCXKQcXKkrSL1r9GWDXMk8wqBLNmbRH96BtOFqVZ7UYG3gC8D9cMS7Y9UrHLVCLZPJO8_CL_6GNCOg_zhJS8PbXmGTcBpgxfkieOPhNfthtf2gC_qD3YOce8nCwG2uwBOqeMoML9NBC1xb9yk6SuJhHLK7SM6LVfCve_3vLKlqcL6TxL_UosDvHLxrHmWgxBQ8Xs',
                    'x-zse-96': '2.0_QPcMOIOcpxNokuISML9Mt1R/M8eHpVl7w3RgZ1MbTSf3vfgzOv/xqXbYupbcHpYh'}
        ), (
                '/api/v4/comment_v5/comment/435679281/child_comment?order=sort&offset=&limit=10'
                ,
                '_zap=ea5d604f-bc9e-4270-bf6f-4fba1b4a53cc;HMACCOUNT_BFESS=D1254182CA16064E;d_c0=ATCSHbj8OxmPTrRSnKZxrjZwkDh33UfHcPc=|1726302401;__snaker__id=9itjCJbxvIRtKpOf;q_c1=2b26643ef8f34e78829b7919ec735702|1726302413000|1726302413000;BAIDUID_BFESS=5B09A0CFC3F82E1F77A1317C06B799C8:FG=1;z_c0=2|1:0|10:1732455169|4:z_c0|80:MS4xOWc1RUVBQUFBQUFtQUFBQVlBSlZUUUY1TUdpemtYdGVDNjNZM3ZLMS1XY0RlMVJYTlZ2Z1ZnPT0=|ae51878bb0c2bb3f7494093913c27815f1985d9def8a32a186b9a63ca47d616f;__zse_ck=003_bqjyB3HX9LE8dVZmojSbMBFPZanFjtrRxywEXkokHNzejeyw57Z2+4XUPwST=ZL3BsipK+OxsdIZGwIR7dLnJoSL/XvV2gigmVxzF+vS+Q1T;BEC=684e706569bf16169217bb2a788786f3;BEC=1d78a1ec103a43b0d2c4340657960c71;_xsrf=190f9885-c301-4cf7-8b71-b73e85500956;tst=r;BEC=244e292b1eefcef20c9b81b1d9777823;Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1732462514,1732462579,1732462606,1732462792;Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1732462792;HMACCOUNT=D1254182CA16064E;SESSIONID=QgPps6f83gJEuWwHd7UJYk36RrubMZOzs6UQhbiGNIK;JOID=UFgWBUgajOGhDcIXWB7vckO1Oi9ASei01H_2cmUo6ajhfZRiE9PCosIOwxFYyLxPM-me_VcPrcHI-r8NkpWXFeg=;osd=VF4SBUweiuWhCcYRXB7rdkWxOitET-y00HvwdmUs7a7lfZBmFdfCpsYIxxFczLpLM-2a-1MPqcXO_r8JlpOTFew='
                ,
                {
                    'x-zst-81': '3_2.0aR_sn77yn6O92wOB8hPZnQr0EMYxc4f18wNBUgpTQ6nxERFZfTY0-4Lm-h3_tufIwJS8gcxTgJS_AuPZNcXCTwxI78YxEM20s4PGDwN8gGcYAupMWufIoLVqr4gxrRPOI0cY7HL8qun9g93mFukyigcmebS_FwOYPRP0E4rZUrN9DDom3hnynAUMnAVPF_PhaueTFH9fQL39OCCqYTxfb0rfi9wfPhSM6vxGDJo_rBHpQGNmBBLqPJHK2_w8C9eTVMO9Z9NOrMtfhGH_DgpM-BNM1DOxScLG3gg1Hre1FCXKQcXKkrSL1r9GWDXMk8wqBLNmbRH96BtOFqVZ7UYG3gC8D9cMS7Y9UrHLVCLZPJO8_CL_6GNCOg_zhJS8PbXmGTcBpgxfkieOPhNfthtf2gC_qD3YOce8nCwG2uwBOqeMoML9NBC1xb9yk6SuJhHLK7SM6LVfCve_3vLKlqcL6TxL_UosDvHLxrHmWgxBQ8Xs',
                    'x-zse-96': '2.0_yYKuXqYyrcRS=3HWHKBk3UfGJu7GgxsnyujThsVjhNn9SklK9tVd2hFNwZh68AkA'}
        )
    ]:
        assert res['x-zst-81'] == get_sign(url, cookies)['x-zst-81']
        assert res['x-zse-96'] == get_sign(url, cookies)['x-zse-96']
        logger.debug('success on {}', url)


if __name__ == '__main__':
    pass
