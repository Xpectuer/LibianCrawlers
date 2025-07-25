import { DataClean } from "../util.ts";
export enum PlatformEnum {
  小红书 = "xiaohongshu.com",
  哔哩哔哩 = "bilibili.com",
  拼多多h5yangkeduo = "mobile.yangkeduo.com",
  百度搜索 = "www.baidu.com",
  知网 = "cnki.net",
  PubMed = "pubmed.ncbi.nlm.nih.gov",
  千牛聊天记录 = "qn.taobao.com/home.htm/app-customer-service/toolpage/Message",
  Embase或镜像站 = "Embase_Or_Proxy",
  文献 = "literatures",
  lib_impact_factor = "github__suqingdong__impact_factor",
  wos_journal = "wos-journal.info",
  维普 = "cqvip.com",
  万方 = "wanfangdata.com.cn",
  WashingtonPost = "www.washingtonpost.com",
  Reuters = "www.reuters.com",
  APNews = "www.apnews.com",
  WebOfScience = "www.webofscience.com",
  未分类 = "unknown",
}

export type MediaContentTag = {
  text: string;
  url?: DataClean.HttpUrl;
};

export type MediaContentAuthor = {
  /**
   * 平台的用户id
   */
  platform_user_id: string | number;
  /**
   * 昵称
   */
  nickname: string;
  /**
   * 头像
   */
  avater_url: DataClean.HttpUrl | null;
  /**
   * 用户主页链接
   */
  home_link_url: DataClean.HttpUrl | null;
};

export type MediaSearchContext = {
  /**
   * 搜索词
   */
  question: string;
};

export type MediaContent = {
  last_crawl_time: Temporal.Instant;
  /**
   * 标题
   */
  title: string;
  /**
   * 缩减的正文，例如知乎上展开内容之前的带省略号的内容。
   */
  content_text_summary: string | null;
  /**
   * 正文
   */
  content_text_detail: string | null;
  /**
   * 正文内容链接
   */
  content_link_url: DataClean.HttpUrl;
  /**
   * 发布者
   */
  authors: MediaContentAuthor[];
  /**
   * 平台
   */
  platform: PlatformEnum;
  /**
   * 平台的可用于去重的ID
   */
  platform_duplicate_id: string;
  /**
   * 阅览数
   */
  count_read: DataClean.NaturalNumber | null;
  /**
   * 点赞数
   */
  count_like: DataClean.NaturalNumber | null;
  /**
   * 从搜索中读取
   */
  from_search_context: MediaSearchContext[];
  /**
   * 创建时间
   */
  create_time: Temporal.Instant | null;
  /**
   * 最后更新时间
   */
  update_time: Temporal.Instant | null;
  /**
   * Tag
   */
  tags: MediaContentTag[] | null;
  /**
   * IP地区
   */
  ip_location: string | null;
  /**
   * 封面链接
   */
  cover_url: DataClean.HttpUrl | null;
  /**
   * 分享数
   */
  count_share: DataClean.NaturalNumber | null;
  /**
   * 收藏数
   */
  count_star: DataClean.NaturalNumber | null;
  /**
   * 总弹幕数
   */
  video_total_count_danmaku: DataClean.NaturalNumber | null;
  /**
   * 总视频时长
   */
  video_total_duration_sec: number | null;
  /**
   * 评论数
   */
  count_comment: DataClean.NaturalNumber | null;
  /**
   * 平台所提供的排序排名值
   */
  platform_rank_score: number | null;
  /**
   * 视频列表
   */
  videos: MediaVideo[] | null;
  /**
   * 文献相关
   */
  literatures: LiteratureAbout[] | null;
  /**
   * 语言
   */
  language: string | null;
};

export type LiteratureAbout = {
  journal: string | null;
  issn: DataClean.ISSN | null;
  isbn: string | null;
  publication_type: string | null;
  doi: string | null;
  pui: string | null;
  category: string | null;
  level_of_evidence: string | null;
  book_publisher: string | null;
  cnsn: string | null;
  eissn: string | null;
  // album: string | null;
  // theme: string | null;
  // funds: string[] | null;
  // author_organizations:
  //   | { nickname: string; webpages: string[] | null }[]
  //   | null;
};

export type MediaVideo = {
  /**
   * 视频播放量
   */
  count_play: DataClean.NaturalNumber | null;
  /**
   * 视频重播数
   */
  count_review: DataClean.NaturalNumber | null;
  /**
   * 弹幕数
   */
  count_danmaku: DataClean.NaturalNumber | null;
  /**
   * 视频下载地址
   */
  download_urls: {
    url: DataClean.HttpUrl;
    is_master: boolean;
    key: string;
  }[];
  /**
   * 视频时长（秒）
   */
  duration_sec: number | null;
};

/**
 * 相关搜索
 */
export type MediaRelatedSearches = {
  question: string;
  related_questions: {
    name: string;
    cover_url: DataClean.HttpUrl | null;
    search_word: string;
  }[];
  tip_text: string;
  request_time: Temporal.Instant;
};
