import { TestUtil } from "../../util.ts";
import { LLMReq } from "./llmreq.ts";

const { llmreq_params } = await TestUtil.read_vars();
const ignore = !(llmreq_params && llmreq_params.length > 0);

// Deno.test({
//   ignore,
//   name: "llmreq_test",
//   fn: async () => {
//     if (ignore) {
//       return;
//     }
//     for (const p of llmreq_params) {
//       const http_client = Deno.createHttpClient({
//         proxy: p.proxy,
//       });
//       try {
//         const res = await LLMReq.llmreq({
//           http_client,
//           model: p.model,
//           question: p.question,
//           remote: p.remote,
//         });
//         console.debug("LLMReq result", res);
//       } finally {
//         http_client.close();
//       }
//     }
//   },
// });
