import { DataClean } from "../../util.ts";
import { PlatformEnum } from "../common/media.ts";

export interface ChatMessage {
  platform: PlatformEnum;
  platform_duplicate_id: string;
  create_time: Temporal.Instant;
  update_time: Temporal.Instant | null;
  content_plain_text: string | null;
  content_img_url: DataClean.HttpUrl | null;
  user_sendfrom: ChatMessageUserInfo | null;
  user_sendto: ChatMessageUserInfo | null;
  group_sendto: ChatMessageUserInfo | null;
  user_employer: ChatMessageUserInfo | null;
  user_employee: ChatMessageUserInfo | null;
  user_customer: ChatMessageUserInfo | null;
}

export interface ChatMessageUserInfo {
  platform_id: string | null;
  nickname: string | null;
  avater_url: DataClean.HttpUrl | null;
}
