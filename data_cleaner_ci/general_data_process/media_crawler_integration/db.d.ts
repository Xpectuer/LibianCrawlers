import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface BilibiliContactInfo {
  add_ts: string | null;
  fan_avatar: string | null;
  fan_id: string | null;
  fan_name: string | null;
  fan_sign: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  up_avatar: string | null;
  up_id: string | null;
  up_name: string | null;
  up_sign: string | null;
}

export interface BilibiliUpDynamic {
  add_ts: string | null;
  dynamic_id: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  pub_ts: string | null;
  text: string | null;
  total_comments: number | null;
  total_forwards: number | null;
  total_liked: number | null;
  type: string | null;
  user_id: string | null;
  user_name: string | null;
}

export interface BilibiliUpInfo {
  add_ts: string | null;
  avatar: string | null;
  id: Generated<number>;
  is_official: number | null;
  last_modify_ts: string | null;
  nickname: string | null;
  sex: string | null;
  sign: string | null;
  total_fans: number | null;
  total_liked: number | null;
  user_id: string | null;
  user_rank: number | null;
}

export interface BilibiliVideo {
  add_ts: string | null;
  avatar: string | null;
  create_time: string | null;
  desc: string | null;
  disliked_count: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  liked_count: number | null;
  nickname: string | null;
  source_keyword: string | null;
  title: string | null;
  user_id: string | null;
  video_coin_count: string | null;
  video_comment: string | null;
  video_cover_url: string | null;
  video_danmaku: string | null;
  video_favorite_count: string | null;
  video_id: string;
  video_play_count: string | null;
  video_share_count: string | null;
  video_type: string | null;
  video_url: string;
}

export interface BilibiliVideoComment {
  add_ts: string | null;
  avatar: string | null;
  comment_id: string | null;
  content: string | null;
  create_time: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  like_count: string | null;
  nickname: string | null;
  parent_comment_id: string | null;
  sex: string | null;
  sign: string | null;
  sub_comment_count: string | null;
  user_id: string | null;
  video_id: string | null;
}

export interface DouyinAweme {
  add_ts: string | null;
  avatar: string | null;
  aweme_id: string | null;
  aweme_type: string | null;
  aweme_url: string | null;
  collected_count: string | null;
  comment_count: string | null;
  cover_url: string | null;
  create_time: string | null;
  desc: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  liked_count: string | null;
  music_download_url: string | null;
  nickname: string | null;
  note_download_url: string | null;
  sec_uid: string | null;
  share_count: string | null;
  short_user_id: string | null;
  source_keyword: string | null;
  title: string | null;
  user_id: string | null;
  user_signature: string | null;
  user_unique_id: string | null;
  video_download_url: string | null;
}

export interface DouyinAwemeComment {
  add_ts: string | null;
  avatar: string | null;
  aweme_id: string | null;
  comment_id: string | null;
  content: string | null;
  create_time: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  like_count: string | null;
  nickname: string | null;
  parent_comment_id: string | null;
  pictures: string | null;
  sec_uid: string | null;
  short_user_id: string | null;
  sub_comment_count: string | null;
  user_id: string | null;
  user_signature: string | null;
  user_unique_id: string | null;
}

export interface DyCreator {
  add_ts: string | null;
  avatar: string | null;
  desc: string | null;
  fans: string | null;
  follows: string | null;
  gender: string | null;
  id: Generated<number>;
  interaction: string | null;
  ip_location: string | null;
  last_modify_ts: string | null;
  nickname: string | null;
  user_id: string | null;
  videos_count: string | null;
}

export interface KuaishouVideo {
  add_ts: string | null;
  avatar: string | null;
  create_time: string | null;
  desc: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  liked_count: string | null;
  nickname: string | null;
  source_keyword: string | null;
  title: string | null;
  user_id: string | null;
  video_cover_url: string | null;
  video_id: string | null;
  video_play_url: string | null;
  video_type: string | null;
  video_url: string | null;
  viewd_count: string | null;
}

export interface KuaishouVideoComment {
  add_ts: string | null;
  avatar: string | null;
  comment_id: string | null;
  content: string | null;
  create_time: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  nickname: string | null;
  sub_comment_count: string | null;
  user_id: string | null;
  video_id: string | null;
}

export interface TiebaComment {
  add_ts: string | null;
  comment_id: string | null;
  content: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  note_id: string | null;
  note_url: string | null;
  parent_comment_id: string | null;
  publish_time: string | null;
  sub_comment_count: number | null;
  tieba_id: string | null;
  tieba_link: string | null;
  tieba_name: string | null;
  user_avatar: string | null;
  user_link: string | null;
  user_nickname: string | null;
}

export interface TiebaCreator {
  add_ts: string | null;
  avatar: string | null;
  fans: string | null;
  follows: string | null;
  gender: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  nickname: string | null;
  registration_duration: string | null;
  user_id: string | null;
  user_name: string | null;
}

export interface TiebaNote {
  add_ts: string | null;
  desc: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  note_id: string | null;
  note_url: string | null;
  publish_time: string | null;
  source_keyword: string | null;
  tieba_id: string | null;
  tieba_link: string | null;
  tieba_name: string | null;
  title: string | null;
  total_replay_num: number | null;
  total_replay_page: number | null;
  user_avatar: string | null;
  user_link: string | null;
  user_nickname: string | null;
}

export interface WeiboCreator {
  add_ts: string | null;
  avatar: string | null;
  desc: string | null;
  fans: string | null;
  follows: string | null;
  gender: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  nickname: string | null;
  tag_list: string | null;
  user_id: string | null;
}

export interface WeiboNote {
  add_ts: string | null;
  avatar: string | null;
  comments_count: string | null;
  content: string | null;
  create_date_time: string | null;
  create_time: string | null;
  gender: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  liked_count: string | null;
  nickname: string | null;
  note_id: string | null;
  note_url: string | null;
  profile_url: string | null;
  shared_count: string | null;
  source_keyword: string | null;
  user_id: string | null;
}

export interface WeiboNoteComment {
  add_ts: string | null;
  avatar: string | null;
  comment_id: string | null;
  comment_like_count: string | null;
  content: string | null;
  create_date_time: string | null;
  create_time: string | null;
  gender: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  nickname: string | null;
  note_id: string | null;
  parent_comment_id: string | null;
  profile_url: string | null;
  sub_comment_count: string | null;
  user_id: string | null;
}

export interface XhsCreator {
  add_ts: string | null;
  avatar: string | null;
  desc: string | null;
  fans: string | null;
  follows: string | null;
  gender: string | null;
  id: Generated<number>;
  interaction: string | null;
  ip_location: string | null;
  last_modify_ts: string | null;
  nickname: string | null;
  tag_list: string | null;
  user_id: string | null;
}

export interface XhsNote {
  add_ts: string | null;
  avatar: string | null;
  collected_count: string | null;
  comment_count: string | null;
  desc: string | null;
  id: Generated<number>;
  image_list: string | null;
  ip_location: string | null;
  last_modify_ts: string | null;
  last_update_time: string | null;
  liked_count: string | null;
  nickname: string | null;
  note_id: string | null;
  note_url: string | null;
  share_count: string | null;
  source_keyword: string | null;
  tag_list: string | null;
  time: string | null;
  title: string | null;
  type: string | null;
  user_id: string | null;
  video_url: string | null;
  xsec_token: string | null;
}

export interface XhsNoteComment {
  add_ts: string | null;
  avatar: string | null;
  comment_id: string | null;
  content: string | null;
  create_time: string | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  like_count: string | null;
  nickname: string | null;
  note_id: string | null;
  parent_comment_id: string | null;
  pictures: string | null;
  sub_comment_count: number | null;
  user_id: string | null;
}

export interface ZhihuComment {
  add_ts: string | null;
  comment_id: string | null;
  content: string | null;
  content_id: string | null;
  content_type: string | null;
  dislike_count: number | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  like_count: number | null;
  parent_comment_id: string | null;
  publish_time: string | null;
  sub_comment_count: number | null;
  user_avatar: string | null;
  user_id: string | null;
  user_link: string | null;
  user_nickname: string | null;
}

export interface ZhihuContent {
  add_ts: string | null;
  comment_count: number | null;
  content_id: string | null;
  content_text: string | null;
  content_type: string | null;
  content_url: string | null;
  created_time: string | null;
  desc: string | null;
  id: Generated<number>;
  last_modify_ts: string | null;
  question_id: string | null;
  source_keyword: string | null;
  title: string | null;
  updated_time: string | null;
  user_avatar: string | null;
  user_id: string | null;
  user_link: string | null;
  user_nickname: string | null;
  user_url_token: string | null;
  voteup_count: number | null;
}

export interface ZhihuCreator {
  add_ts: string | null;
  anwser_count: number | null;
  article_count: number | null;
  column_count: number | null;
  fans: number | null;
  follows: number | null;
  gender: string | null;
  get_voteup_count: number | null;
  id: Generated<number>;
  ip_location: string | null;
  last_modify_ts: string | null;
  question_count: number | null;
  url_token: string | null;
  user_avatar: string | null;
  user_id: string | null;
  user_link: string | null;
  user_nickname: string | null;
  video_count: number | null;
}

export interface DB {
  bilibili_contact_info: BilibiliContactInfo;
  bilibili_up_dynamic: BilibiliUpDynamic;
  bilibili_up_info: BilibiliUpInfo;
  bilibili_video: BilibiliVideo;
  bilibili_video_comment: BilibiliVideoComment;
  douyin_aweme: DouyinAweme;
  douyin_aweme_comment: DouyinAwemeComment;
  dy_creator: DyCreator;
  kuaishou_video: KuaishouVideo;
  kuaishou_video_comment: KuaishouVideoComment;
  tieba_comment: TiebaComment;
  tieba_creator: TiebaCreator;
  tieba_note: TiebaNote;
  weibo_creator: WeiboCreator;
  weibo_note: WeiboNote;
  weibo_note_comment: WeiboNoteComment;
  xhs_creator: XhsCreator;
  xhs_note: XhsNote;
  xhs_note_comment: XhsNoteComment;
  zhihu_comment: ZhihuComment;
  zhihu_content: ZhihuContent;
  zhihu_creator: ZhihuCreator;
}
