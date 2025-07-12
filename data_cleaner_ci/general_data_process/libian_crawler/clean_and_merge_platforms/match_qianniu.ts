import { LibianCrawlerGarbage } from "../../../user_code/LibianCrawlerGarbage.ts";
import { DataClean, Errors, Mappings, Times } from "../../../util.ts";
import { PlatformEnum } from "../../media.ts";
import { LibianCrawlerCleanAndMergeUtil } from "../clean_and_merge_util.ts";
import { LibianCrawlerGarbageCleaner } from "./index.ts";
import { ChatMessage } from "../../chat_message.ts";

export const match_qianniu_message_export: LibianCrawlerGarbageCleaner<
  ChatMessage & {
    __mode__: "chat_message";
  }
> = {
  match: async function* (
    garbage: LibianCrawlerGarbage,
  ) {
    const smart_crawl = garbage.obj;
    if (!("template_parse_html_tree" in smart_crawl)) {
      return;
    }
    const { template_parse_html_tree } = smart_crawl;
    if (
      template_parse_html_tree.qianniu_message_export &&
      "messages" in template_parse_html_tree.qianniu_message_export &&
      template_parse_html_tree.qianniu_message_export.messages
    ) {
      const {
        messages: messages_no_order,
        active_user_nickname,
        shopname,
        shop_icon,
      } = template_parse_html_tree.qianniu_message_export;
      const user_employer: ChatMessage["user_employer"] = {
        nickname: shopname ?? null,
        platform_id: null,
        avater_url: DataClean.url_use_https_emptyable(shop_icon),
      };
      const user_customer: ChatMessage["user_customer"] = {
        nickname: active_user_nickname ?? null,
        platform_id: null,
        avater_url: null,
      };

      const messages_no_order_2 = Array.isArray(messages_no_order)
        ? messages_no_order
        : [messages_no_order] as const;

      let messages_ordered: Array<
        {
          create_time: Temporal.Instant;
          chatName: string;
          chatTextLeft: string | null;
          img: string | null;
        }
      > = [];
      let current_group_time: string | null = null;
      for (const msg of messages_no_order_2) {
        if (Mappings.object_keys(msg).length <= 0) {
          continue;
        }
        if ("groupTime" in msg && msg.groupTime) {
          current_group_time = msg.groupTime;
          continue;
        }
        if (current_group_time === null) {
          continue;
          // throw new Error(
          //   `Why current group time not setting , qianniu_message_export is :${
          //     Jsons.dump(
          //       template_parse_html_tree.qianniu_message_export,
          //       { indent: 2 },
          //     )
          //   }`,
          // );
        }
        if (
          !("chatTime" in msg && msg.chatTime) ||
          !("chatName" in msg && msg.chatName) ||
          (!msg.chatTextLeft && !msg.img)
        ) {
          continue;
          // throw new Error(
          //   `Not found msg property , msg is ${Jsons.dump(msg)}`,
          // );
        }
        const create_time = Times.parse_instant(
          `${current_group_time} ${msg.chatTime}`,
        );
        if (!create_time) {
          Errors.throw_and_format("Parse time invalid", { msg });
        }
        messages_ordered.push({
          chatName: msg.chatName,
          chatTextLeft: msg.chatTextLeft?.trim() ? msg.chatTextLeft : null,
          img: msg.img?.trim() ? msg.img : null,
          create_time,
        });
      }
      messages_ordered = messages_ordered.sort((a, b) => {
        return Temporal.Instant.compare(a.create_time, b.create_time);
      });
      let user_employee: ChatMessage["user_employee"] = null;
      for (const msg of messages_ordered) {
        const _chatName = msg.chatName;
        let user_sendfrom: ChatMessage["user_sendfrom"];
        let user_sendto: ChatMessage["user_sendto"];
        if (_chatName === user_customer.nickname) {
          user_sendfrom = user_customer;
          if (user_employee === null) {
            user_sendto = user_employer;
          } else {
            user_sendto = user_employee;
          }
        } else {
          user_employee = {
            nickname: _chatName,
            platform_id: null,
            avater_url: null,
          };
          user_sendfrom = user_employee;
          user_sendto = user_customer;
        }
        const res: Omit<ChatMessage, "platform_duplicate_id"> = {
          platform: PlatformEnum.千牛聊天记录,
          create_time: msg.create_time,
          update_time: null,
          content_plain_text: msg.chatTextLeft ?? null,
          content_img_url: DataClean.url_use_https_emptyable(msg.img),
          user_sendfrom,
          user_sendto,
          group_sendto: null,
          user_employer,
          user_employee,
          user_customer,
        };
        const res2: ChatMessage & {
          __mode__: "chat_message";
        } = {
          __mode__: "chat_message",
          ...res,
          platform_duplicate_id: LibianCrawlerCleanAndMergeUtil
            .compute_platform_duplicate_id_for_chat_message(
              res,
            ),
        };
        yield res2;
        continue;
      }
    }
  },
};
