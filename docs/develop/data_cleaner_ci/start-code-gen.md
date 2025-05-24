# 3-启动代码生成

## 类型生成

### 运行脚本

:::details 代码生成脚本将会为你执行以下操作

1. 将创建 `./data_cleaner_ci_generated/` 目录和 `./user_code/` 符号链接目录。这两个目录已被 `.gitignore` 排除，不会被代码管理。
2. 将在 `./data_cleaner_ci_generated/` 目录中执行以下操作：
    - 生成配置文件并保存到 **用户家目录** 的配置中，然后将配置文件 **符号链接**
      至 `./data_cleaner_ci_generated/config.json`，以便进行 TypeScript 类型检查。
    - 根据配置文件内容，在 `./data_cleaner_ci_generated` 目录下生成数仓中的数据类型和接口 API。
3. 将创建私人代码目录 `$HOME/.libian/crawler/data_cleaner_ci/user_code` 并将其 **符号链接** 至 `./user_code/`。
    - 以便进行 TypeScript 类型检查。
    - 其他公共脚本需要从 `./user_code/` 目录中导入类型，以免私人代码中的类型名称直接被公共代码使用。

:::

在设置好数据仓库后，执行以下命令以全量数据生成数仓的 API 代码:

```shell
deno task init:code_gen
```

`init:code_gen` 命令详情参考:

::: code-group

```shell [查看帮助]
deno task init:code_gen --help
```

<<< @/../data_cleaner_ci/code_gen_help.txt{txt} [查看帮助: 输出]

```shell [小窍门: 跳过已存在的批次]
# 跳过已存在的 batch 类型生成，以便只生成增量数据的类型，非常节省时间。
# 但是要注意，如果你的 jsonata_template 改变，存量数据的 jsonata 转换输出会发生变化，请确保你的旧数据不受巨大影响时才能 --skip-existed。

deno task init:code_gen --skip-existed
```
:::

### 检查结果

完成后，初始化工作就已经完成。然而，如果您需要适配并运行 `general_data_process` 目录下的公用脚本，您需要手动处理 TypeScript
类型导入。

您可以通过运行以下命令，检查生成的类型是否满足公开脚本的类型推断，并运行测试：

```shell
deno tasks step:check
```
