export default {
  watch: ["./step_api_mates.json"],
  async load(watchedFiles: string[]) {
    const { createMarkdownRenderer } = await import("vitepress");
    const config = globalThis.VITEPRESS_CONFIG;
    const md = await createMarkdownRenderer(
      config.srcDir,
      config.markdown,
      config.site.base,
      config.logger,
    );
    const step_api_metas = (await import("./step_api_metas.json")).default;
    let content = "";
    for (const meta of step_api_metas) {
      content += `#### ${meta.name} 

${meta.desc}
`;
      const enable_param_view = meta.args.length + meta.kwargs.length > 0 ||
        meta.varargs;

      if (enable_param_view) {
        content += `
:::: info Params
`;

        for (
          const arg of [
            ...meta.args,
            ...(meta.varargs
              ? [
                {
                  name: "*args",
                  is_varargs: true,
                  index: meta.args_max
                    ? `[${meta.args.length}:${meta.args_max}]`
                    : meta.args.length,
                  require: meta.args_min > meta.args.length,
                  desc: "",
                  type: meta.varargs_types,
                },
              ]
              : []),
            ...meta.kwargs,
          ] as const
        ) {
          let arg_content = "";
          arg_content +=
            `<b id="${meta.name}__${arg.name}" style="font-size: 0.9rem;" >${arg.name}</b>`;
          const is_varargs = "is_varargs" in arg && arg.is_varargs;
          if (is_varargs) {
            arg_content += `<span class="VPBadge info">vararg</span>`;
          } else if (
            "index" in arg && typeof arg.index !== "undefined" &&
            arg.index !== null
          ) {
            arg_content +=
              `<span class="VPBadge info">arg[${arg.index}]</span>`;
          } else {
            arg_content += `<span class="VPBadge info">kwarg</span>`;
          }
          if (arg.require) {
            arg_content += `<span class="VPBadge warning">require</span>`;
          } else {
            arg_content += `<span class="VPBadge info">optional</span>`;
          }
          arg_content += `\n\n${arg.desc}\n\n`;

          if (is_varargs && (Array.isArray(arg.type) || arg.type === null)) {
            if (arg.type !== null && arg.type.length > 0) {
              arg_content += `::: code-group\n`;
              for (let i = 0; i < arg.type.length; i++) {
                const typ = arg.type[i];
                arg_content += `\n
\`\`\`json:line-numbers [arg.type[${i}]]
${JSON.stringify(typ.json_schema, null, 4)}
\`\`\`
`;
              }
              arg_content += `:::\n`;
            }
          } else if (arg.type !== null && !Array.isArray(arg.type)) {
            if (
              "examples" in arg.type.json_schema &&
              Array.isArray(arg.type.json_schema.examples) &&
              arg.type.json_schema.examples.length > 0
            ) {
              arg_content += `Examples: `;
              for (const example of arg.type.json_schema.examples) {
                arg_content += `\`${JSON.stringify(example)}\` `;
              }
              arg_content += "\n";
            }

            arg_content += `::: code-group\n`;
            if (arg.type.py_hint && arg.type.py_hint !== "None") {
              arg_content += `\n
\`\`\`txt [type_hint]
${arg.type.py_hint}
\`\`\`
`;
            }

            if (arg.type.json_schema) {
              arg_content += `\n
\`\`\`json:line-numbers [jsonschema]
${JSON.stringify(arg.type.json_schema, null, 4)}
\`\`\`
:::
`;
            }
          } else {
            throw new Error("Invalid arg.type");
          }

          content += `\n\n
${arg_content.split("\n").map((line) => `> ${line}`).join("\n")}
`;
        }
        content += `
::::
`;
      }
    }
    return md.render(content);
  },
};
