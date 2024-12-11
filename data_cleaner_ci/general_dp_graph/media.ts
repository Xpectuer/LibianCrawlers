import { Nums } from "../util.ts";

export enum PlatformEnum {
  小红书 = "xiaohongshu.com",
  哔哩哔哩 = "bilibili.com",
}

export type MediaContentTag = {
  text: string;
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
  avater_url: string;
  /**
   * 用户主页链接
   */
  home_link_url: string;
};

export type MediaSearchContext = {
  /**
   * 搜索词
   */
  question: string;
};

export type MediaContent = {
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
  content_link_url: string;
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
  count_read: Nums.NaturalNumber | null;
  /**
   * 点赞数
   */
  count_like: Nums.NaturalNumber;
  /**
   * 从搜索中读取
   */
  from_search_context: MediaSearchContext[];
  /**
   * 创建时间
   */
  create_time: Date | null;
  /**
   * 最后更新时间
   */
  update_time: Date | null;
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
  cover_url: string | null;
  /**
   * 分享数
   */
  count_share: Nums.NaturalNumber | null;
  /**
   * 收藏数
   */
  count_star: Nums.NaturalNumber | null;
  /**
   * 总弹幕数
   */
  video_total_count_danmaku: Nums.NaturalNumber | null;
  /**
   * 总视频时长
   */
  video_total_duration_sec: number | null;
  /**
   * 评论数
   */
  count_comment: Nums.NaturalNumber | null;
  /**
   * 平台所提供的排序排名值
   */
  platform_rank_score: Nums.NaturalNumber | null;
  /**
   * 视频列表
   */
  videos: MediaVideo[] | null;
};

export type MediaVideo = {
  /**
   * 视频播放量
   */
  count_play: Nums.NaturalNumber | null;
  /**
   * 视频重播数
   */
  count_review: Nums.NaturalNumber | null;
  /**
   * 弹幕数
   */
  count_danmaku: Nums.NaturalNumber | null;
  /**
   * 视频下载地址
   */
  download_urls: {
    url: string;
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
    cover_url: string | null;
    search_word: string;
  }[];
  tip_text: string;
  request_time: Date;
};
