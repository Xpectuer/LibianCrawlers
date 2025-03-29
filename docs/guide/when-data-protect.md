# 5-私有数据保护

## 在数据采集时

工程目录下的 .data/ 目录是用于存储临时数据的工作目录，该目录不会被版本管理系统-tracking。以下是 `.gitignore` 片段:

:::code-group
<<< @/../.gitignore#output_dirs{1 txt} [.gitignore]
:::

一些爬取结果也会默认保存在该目录下，因为并不是所有爬取的数据都需要立即写入数据库中。

在第一次执行数据采集时，如果没有找到配置文件，则会自动生成一个配置文件在用户家目录下，通过符号链接（symlink）的方式关联到工程目录。请参考 [在启动之前做好配置](../develop/crawler/init-config.md)。

## 在数据清洗时

在执行数据清洗任务之前，用户可以通过 `deno task init:config` 命令 [初始化配置文件](../develop/data_cleaner_ci/init-config.md):

该命令会:

1. 在用户家目录下创建必要的工程文件和目录。
2. 在项目根目录中生成相应的符号链接（symlink），用于引用这些配置文件。

### 配置文件的保护机制

为了确保配置文件的敏感信息不被纳入版本控制，以下目录和文件会被 .gitignore 规则排除：

:::code-group
<<< @/../data_cleaner_ci/.gitignore{txt} [data_cleaner_ci/.gitignore]

<<< @/../.gitignore#output_dirs{1 txt} [.gitignore]
:::

### 用户私有代码的管理

用户可以在 `data_cleaner_ci/user_code/` 目录中存放任何与保护和封装私有代码相关的逻辑。以下是一些示例代码，供参考:

:::code-group
<<< @/guide/when-data-protect-examples/example1.ts
<<< @/guide/when-data-protect-examples/MyPrivateNocoPGLibianCrawlerGarbage_api.ts
<<< @/guide/when-data-protect-examples/example3.ts
:::
