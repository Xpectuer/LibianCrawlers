Deno.test(function xhs_regexp_test() {
  console.debug(
    "get xiaohongshu note id",
    /xiaohongshu\.com\/explore\/([a-zA-Z0-9]+)/.exec(
      "https://www.xiaohongshu.com/explore/673dfc49000000000201b6f9?xsec_token=AB0bZUpoclWPCupj6GqcXQ-kG_kFQZ8UrT5lBQtRvBKJU=&xsec_source=pc_feed&source=web_explore_feed#comment-674a65a7000000001b025b27"
    )
  );
});
