import { get_config } from "./config.ts";

Deno.test(function readConfigTest() {
  const config = get_config();
  console.log("config repositories", config.repositories);
});
