# 5-私有数据保护

数据保护措施是为了保护以下内容不泄漏。

## 数据采集和清洗时的个人信息

在数据采集 **之前的配置、之后的原始数据** 中会带有私人信息，这些信息同样会存在于数据清洗的类型生成结果中。

因此，`deno task init:config` 命令和 `deno task init:code_gen` 命令的输出目录 `data_cleaner_ci_generated` 会被 gitignore
排除。

:::code-group

<<< @/../data_cleaner_ci/.gitignore{txt} [data_cleaner_ci/.gitignore]

<<< @/../.gitignore#output_dirs{1 txt} [.gitignore]

:::

## 数据清洗时的个人代码

`deno task init:config` 命令的作用是 [初始化配置文件](../develop/data_cleaner_ci/init-config.md)
和创建 `data_cleaner_ci/user_code` 目录符号链接。

:::tip 为什么要在家目录下存放个人代码并符号链接到工程目录
对每个使用该框架的程序员而言，获取数据集的方式都是不同的、且不应当被公开的。

而可以被公开的部分（如爬取方式、清洗方式）则需要被这“中间的黑盒”连接。

因此 `user_code` 符号链接目录指向用户通用的目录，并在工程目录下可供编辑器和脚本类型检查和提供类型推断:

* 公开代码需要通过 **约定俗成** 的类型别名或函数名来调用这个黑盒
* 而黑盒的具体实现则由程序员个人环境决定
:::
