import fs from "node:fs/promises";
import { json } from "node:stream/consumers";

export default {
  watch: ["../../../steps/schemas/main.json"],
  async load(watchedFiles: string[]) {
    const { createMarkdownRenderer } = await import("vitepress");
    const config = globalThis.VITEPRESS_CONFIG;
    const md = await createMarkdownRenderer(
      config.srcDir,
      config.markdown,
      config.site.base,
      config.logger
    );
    return await Promise.all(
      watchedFiles.map(async (file: string) => {
        const schema_str = (await fs.readFile(file, "utf-8")).replaceAll(
          "\r\n",
          "\n"
        );
        const root = JSON.parse(schema_str);

        // const get_last = (arr: any[]) => arr[arr.length - 1];
        // const ignore_last = (arr: unknown[]) => arr.slice(0, arr.length - 1);

        root["__api_list__"] = [
          ...root["definitions"]["Step"]["oneOf"],
          // ...get_last(root["definitions"]["Step"]["oneOf"])["allOf"][0][
          //   "oneOf"
          // ],
        ];

        root["__api_list__"] = (root["__api_list__"] as Array<object>).map(
          (s) => {
            let func_name: string;
            let md_desc = "";

            md_desc +=
              "description" in s && typeof s["description"] === "string"
                ? s["description"]
                : "> TODO: 尚待补充文档...";
            md_desc += "\n\n";

            const arg_table: {
              name: string;
              require: boolean;
              type: string;
              enum: string[] | undefined | null;
              example: any;
              description: string | undefined | null;
              _rg: any;
            }[] = [];

            const parse_type = (rg: unknown) => {
              if (typeof rg !== "object" || rg === null) {
                return "unknown";
              }
              if ("enum" in rg && Array.isArray(rg.enum)) {
                return (
                  "Literal[" +
                  rg.enum.map((it) => `${JSON.stringify(it)}`).join(", ") +
                  "]"
                );
              } else if ("type" in rg && typeof rg.type === "string") {
                if (rg.type === "array" && "items" in rg) {
                  if (typeof rg.items === "object" && rg.items !== null) {
                    return "List[" + parse_type(rg.items) + "]";
                  }
                }

                return rg.type;
              } else if ("$ref" in rg && typeof rg.$ref === "string") {
                const clzname = rg.$ref.split("/").reverse()[0];
                return `[${clzname}](#${clzname.toLowerCase()})`;
              } else if ("oneOf" in rg && Array.isArray(rg.oneOf)) {
                return (
                  "Union[" +
                  rg.oneOf
                    .filter((it) => typeof it === "object")
                    .map((it) => parse_type(it))
                    .join(", ") +
                  "]"
                );
              } else {
                return "unknown";
              }
            };

            if (
              "enum" in s &&
              Array.isArray(s.enum) &&
              s.enum.length === 1 &&
              typeof s.enum[0] === "string"
            ) {
              func_name = s.enum[0];
              md_desc +=
                "\n:::info 示例\n\n```json\n" +
                JSON.stringify(func_name) +
                "\n```\n\n:::\n\n";
            } else if (
              "properties" in s &&
              typeof s.properties === "object" &&
              s.properties &&
              "fn" in s.properties &&
              typeof s.properties.fn === "object" &&
              s.properties.fn &&
              "enum" in s.properties.fn &&
              Array.isArray(s.properties.fn.enum) &&
              s.properties.fn.enum.length === 1 &&
              typeof s.properties.fn.enum[0] === "string"
            ) {
              func_name = s.properties.fn.enum[0];
              let example_json = {
                fn: func_name,
              };
              if (
                "args" in s.properties &&
                typeof s.properties.args === "object" &&
                s.properties.args &&
                "type" in s.properties.args &&
                s.properties.args.type === "array"
              ) {
                let minItems = 0;
                let maxItems = -1;
                if (
                  "minItems" in s.properties.args &&
                  typeof s.properties.args.minItems === "number" &&
                  s.properties.args.minItems > 0
                ) {
                  minItems = s.properties.args.minItems;
                }

                if (
                  "maxItems" in s.properties.args &&
                  typeof s.properties.args.maxItems === "number"
                ) {
                  maxItems = s.properties.args.maxItems;
                }

                // if (maxItems < 0 && minItems > 0) {
                //   md_desc += `* args 长度至少为 ${minItems}\n\n`;
                // }

                if (
                  minItems > 0 &&
                  "required" in s &&
                  Array.isArray(s.required) &&
                  !s.required.includes("args")
                ) {
                  console.warn('Please add "args" to required list', {
                    func_name,
                  });
                }

                // if (minItems === maxItems && !additionalItems) {
                //   if (maxItems === 0) {
                //     md_desc += `* args 可不传，或传入长度必须为 ${minItems}\n\n`;
                //   } else {
                //     md_desc += `* args 长度必须为 ${minItems}\n\n`;
                //   }
                // } else if (maxItems > 0 && !additionalItems) {
                //   md_desc += `* args 长度必须在 [${minItems},${maxItems}] 之间\n\n`;
                // }

                if ("items" in s.properties.args) {
                  let i = 0;
                  if (Array.isArray(s.properties.args.items)) {
                    for (; i < s.properties.args.items.length; i++) {
                      const item = s.properties.args.items[i];

                      arg_table.push({
                        name: `arg[${i}]`,
                        require: i < minItems,
                        type: parse_type(item),
                        enum: item["enum"],
                        example: item["examples"]?.at(0),
                        description: item["description"],
                        _rg: item,
                      });
                    }
                  }

                  if (
                    !(
                      "additionalItems" in s.properties.args &&
                      s.properties.args.additionalItems === false
                    )
                  ) {
                    arg_table.push({
                      name: `arg[${i}...${maxItems < 0 ? "" : maxItems}]`,
                      require: false,
                      type: Array.isArray(s.properties.args.items)
                        ? "unknown"
                        : parse_type(s.properties.args.items),
                      enum: null,
                      example: "",
                      description: "",
                      _rg: undefined,
                    });
                  }

                  //                   md_desc += `
                  // :::details args schema
                  // \`\`\`json
                  // ${JSON.stringify(s.properties.args, null, 2)}
                  // \`\`\`
                  // :::
                  // `;
                }

                if (
                  "examples" in s.properties.args &&
                  Array.isArray(s.properties.args.examples) &&
                  s.properties.args.examples.length > 0
                ) {
                  example_json["args"] = s.properties.args.examples[0];
                } else if (
                  "items" in s.properties.args &&
                  Array.isArray(s.properties.args.items) &&
                  s.properties.args.items.length > 0 &&
                  s.properties.args.items
                    .map(
                      (it: unknown) =>
                        typeof it === "object" &&
                        it &&
                        "examples" in it &&
                        Array.isArray(it.examples) &&
                        it.examples.length > 0
                    )
                    .reduce((prev, cur) => prev && cur)
                ) {
                  example_json["args"] = s.properties.args.items.map(
                    (it: any) => it.examples[0]
                  );
                }
              }

              if (
                "kwargs" in s.properties &&
                typeof s.properties.kwargs === "object" &&
                s.properties.kwargs &&
                "type" in s.properties.kwargs &&
                s.properties.kwargs.type === "object"
              ) {
                let minProperties = 0;
                let maxProperties = -1;
                if (
                  "minProperties" in s.properties.kwargs &&
                  typeof s.properties.kwargs.minProperties === "number" &&
                  s.properties.kwargs.minProperties > 0
                ) {
                  minProperties = s.properties.kwargs.minProperties;
                }

                if (
                  "maxProperties" in s.properties.kwargs &&
                  typeof s.properties.kwargs.maxProperties === "number"
                ) {
                  maxProperties = s.properties.kwargs.maxProperties;
                }

                if (
                  minProperties > 0 &&
                  "required" in s &&
                  Array.isArray(s.required) &&
                  !s.required.includes("kwargs")
                ) {
                  console.warn('Please add "kwargs" to required list', {
                    func_name,
                  });
                }

                if (
                  "examples" in s.properties.kwargs &&
                  Array.isArray(s.properties.kwargs.examples) &&
                  s.properties.kwargs.examples.length > 0
                ) {
                  example_json["kwargs"] = s.properties.kwargs.examples[0];
                }

                let properties_count = 0;
                const additionalProperties_false =
                  "additionalProperties" in s.properties.kwargs &&
                  s.properties.kwargs.additionalProperties === false;
                if (
                  "properties" in s.properties.kwargs &&
                  typeof s.properties.kwargs.properties === "object" &&
                  s.properties.kwargs.properties
                ) {
                  const required =
                    "required" in s.properties.kwargs &&
                    Array.isArray(s.properties.kwargs.required)
                      ? s.properties.kwargs.required
                      : [];
                  if (required.length > minProperties) {
                    console.warn("required.length > minProperties", {
                      func_name,
                      required,
                      minProperties,
                    });
                  }

                  properties_count = Object.keys(
                    s.properties.kwargs.properties
                  ).length;

                  if (additionalProperties_false) {
                    if (properties_count < maxProperties) {
                      console.warn("properties_count < maxProperties", {
                        properties_count,
                        maxProperties,
                        kwargs: s.properties.kwargs,
                      });
                    }
                    if (maxProperties < 0) {
                      console.warn(
                        `Please set maxProperties to ${properties_count}`,
                        {
                          properties_count,
                          maxProperties,
                          kwargs: s.properties.kwargs,
                        }
                      );
                    }
                  }

                  for (const k of Object.keys(s.properties.kwargs.properties)) {
                    const v = s.properties.kwargs.properties[k];

                    arg_table.push({
                      name: `${k}`,
                      require: required.includes(k),
                      type: parse_type(v),
                      enum: v["enum"],
                      example: v["examples"]?.at(0),
                      description: v["description"],
                      _rg: v,
                    });
                  }

                  //                   md_desc += `
                  // :::details kwargs schema
                  // \`\`\`json
                  // ${JSON.stringify(s.properties.kwargs, null, 2)}
                  // \`\`\`
                  // :::
                  // `;
                }

                if (
                  !(
                    additionalProperties_false &&
                    maxProperties >= 0 &&
                    minProperties + properties_count >= maxProperties
                  )
                ) {
                  arg_table.push({
                    name: "**kwargs",
                    require: false,
                    type: "KWARGS",
                    enum: null,
                    example: "",
                    description: "",
                    _rg: undefined,
                  });
                }

                if (
                  "examples" in s.properties.kwargs &&
                  Array.isArray(s.properties.kwargs.examples) &&
                  s.properties.kwargs.examples.length > 0
                ) {
                  example_json["kwargs"] = s.properties.kwargs.examples[0];
                } else if (
                  "properties" in s.properties.kwargs &&
                  typeof s.properties.kwargs.properties === "object" &&
                  s.properties.kwargs.properties !== null &&
                  Object.entries(s.properties.kwargs.properties)
                    .map(
                      ([k, v]) =>
                        typeof v === "object" &&
                        v &&
                        "examples" in v &&
                        Array.isArray(v.examples) &&
                        v.examples.length > 0
                    )
                    .reduce((prev, cur) => prev && cur)
                ) {
                  example_json["kwargs"] = Object.fromEntries(
                    Object.entries(s.properties.kwargs.properties).map(
                      ([k, v]) => [k, v.examples[0]]
                    )
                  );
                }
              }

              if (
                "examples" in s &&
                Array.isArray(s.examples) &&
                s.examples.length > 0
              ) {
                example_json = s.examples[0];
              }

              // example_json["on_success_steps"] = "continue";
              // example_json["on_timeout_steps"] = "continue";

              const example_json_str = JSON.stringify(example_json, null, 2);

              if (arg_table.length > 0) {
                md_desc += "\n | name | require | type | example |";
                md_desc += "\n |---|---|---|---|";
                for (const arg of arg_table) {
                  md_desc += `\n | ${arg.name} | ${
                    arg.require ? "✔️" : ""
                  } | *${arg.type}* | ${
                    arg.example ? `\`${JSON.stringify(arg.example)}\`` : ``
                  } |`;
                }
                md_desc += "\n\n";
              }
              const arg_desc_table = arg_table
                .map((it) => {
                  if (it.type === "object") {
                    const s = `\n\n:::details schema\n\`\`\`json\n${JSON.stringify(
                      it._rg,
                      null,
                      2
                    )}\n\`\`\`\n:::\n\n`;
                    if (!it.description) {
                      it.description = "";
                    }
                    it.description = s + it.description;
                  }
                  return it;
                })
                .filter((it) => it.description?.trim())
                .map((it) => (it.description?.trim() ? it : null))
                .filter((it) => it !== null);
              if (arg_desc_table.length > 0) {
                md_desc += "\n:::details 参数含义文档";
                for (const arg of arg_desc_table) {
                  md_desc += `\n\n> **${arg.name}**`;

                  md_desc += `\n>\n> ${arg.description
                    ?.split("\n")
                    ?.join("\n> ")}`;
                }
                md_desc += "\n:::\n\n";
              }

              md_desc +=
                "\n:::" +
                (example_json_str.split("\n").length <= 15
                  ? "info"
                  : "details") +
                " 示例\n\n```json:line-numbers\n" +
                example_json_str;
              ("\n```\n\n:::\n\n");
            } else {
              func_name = "";
            }
            func_name = func_name.trim();

            s["markdown_html"] = md.render(md_desc);

            let schema_title: string;
            if ("title" in s && typeof s.title === "string") {
              schema_title = s.title;
            } else {
              schema_title = "";
            }
            schema_title = schema_title.trim();
            s["markdown_title"] = [func_name, schema_title]
              .filter((it) => it.length > 0)
              .join("-");
            return s;
          }
        );
        return JSON.stringify(root);
      })
    );
  },
};
