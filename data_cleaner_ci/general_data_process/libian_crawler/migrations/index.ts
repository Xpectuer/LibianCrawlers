import Migration20241225 from "./20241225.ts";
import Migration20241227 from "./20241227.ts";
import Migration20241231 from "./20241231.ts";
import Migration20241231163000 from "./20241231163000.ts";
import Migration20250201154900 from "./20250201154900.ts";
import Migration20250307003800 from "./20250307003800.ts";
import Migration20250307155000 from "./20250307155000.ts";
import Migration20250424015300 from "./20250424015300.ts";
import Migration20250424194600 from "./20250424194600.ts";
import { Mappings } from "../../../util.ts";

export const migrations = Mappings.object_from_entries(
  [
    Migration20241225,
    Migration20241227,
    Migration20241231,
    Migration20241231163000,
    Migration20250201154900,
    Migration20250307003800,
    Migration20250307155000,
    Migration20250424015300,
    Migration20250424194600,
  ].map((it) => [it.version, it] as const)
);
