# 3-数据清洗：确保数据质量与一致性

在数据采集完成后，数据清洗是确保数据质量和一致性的关键步骤。LibianCrawler 提供了一套基于 TypeScript 生态的高效解决方案，针对传统方法中存在的类型推断问题和存储问题进行了优化。

## 数据存储：高效管理结构化与非结构化数据

在数据采集中，原始数据会被直接存储到 PostgreSQL 的 垃圾表 中。此外，对于非结构化数据（如图片）我们使用 MinIO 进行存储，并在 PostgreSQL 中保留其访问 URL。

- **垃圾表的作用**：
  - **原始数据来源**：为后续清洗和转换提供完整的原始数据。
  - **避免数据损失**：接收大部分采集到的数据，无论其格式或类型是否完美，确保不会因过早丢弃某些字段而导致数据损失。

清洗过程中，我们会从垃圾表中读取数据，进行类型转换、字段提取和合并，最终将结构化的清洗结果数据写入 PostgreSQL 的 清洗结果专用表 中。更多关于数据存储的具体方案可参考 [下一章节](./when-data-storage-and-visualization.md) 。

## 数据清洗：基于 TypeScript 的解决方案

LibianCrawler 的数据清洗流程充分利用了 TypeScript 的类型系统，结合 JSON 查询和转换语言 [Jsonata](https://jsonata.org/) 和 类型生成工具 [Quicktype](https://quicktype.io/) ，为开发者提供了一套高效且可靠的数据处理方法。

### 类型生成：直观识别数据类型

在清洗之前，我们首先需要了解垃圾表中存储的数据结构。通过以下步骤，开发者可以快速生成数据类型的定义：

- **从 PostgreSQL 垃圾表迭代读取数据：**
  - 如果原始数据的类型不够整洁，可以使用 Jsonata 进行预转换。Jsonata 是一种基于 JSON 的查询和转换语言，语法灵活，特别适合处理嵌套结构和树状数据。
  - 例如：从 DOM 树结构中提取class为某个值的 tag （类似 XPath 的方式遍历数据）。
- **使用 Quicktype 生成类型定义：**
  - 将预转换后的迭代器数据输入 Quicktype ，它会自动生成 TypeScript 类型定义。
  - 这样可以确保垃圾表中所有字段的类型都被准确识别。

### 数据验证与合并：TypeScript 的类型检查保障

在类型生成完成后，进行数据验证和合并：

- **数据验证**：利用 TypeScript 的类型系统，对数据进行严格的类型检查，确保数据符合预定义的格式和要求。
  - **严格的类型检查：**
    - TypeScript 的类型系统确保清洗过程中难以出现类型错误。
    - 可以对关键字段（如时间格式、数值范围、网络地址等）进行额外验证，进一步提升数据质量。
  - **及时发现网页变动：**
    - 如果网页结构发生变化，类型生成结果也会随之改变，从而导致 `deno check` 类型检查命令失败 和 编辑器类型推断提示报错。这种机制可以帮助开发者快速识别并适应变化。
- **数据合并**：利用 `yield*` 语法合并生成器，对来自不同来源或具有不同结构的数据进行整合，使其成为统一且完整的数据集。

TypeScript 的类型安全特性能够有效减少运行时错误，提高代码质量和维护性。通过清晰的类型定义，开发者可以更直观地理解数据结构，从而更高效地处理和分析数据。

:::details 伪代码示例: 使用 [Jsonata](https://jsonata.org/) 和 [Quicktype](https://quicktype.io/) 处理嵌套数据

假设我们有以下 JSON 数据：

```json
{
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "address": {
        "street": "123 Main St",
        "city": "New York"
      }
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "address": {
        "street": "456 Oak Ave",
        "city": "Los Angeles"
      }
    }
  ]
}
```

使用 Jsonata，我们可以提取所有用户的城市信息:

> 你可以在 https://try.jsonata.org/ 自由尝试 Jsonata 的语法。

```txt [jsonata]
users.address.city
```

结果将是一个包含 “New York” 和 “Los Angeles” 的数组。

```json
["New York", "Los Angeles"]
```

然后，将这些数据输入 Quicktype，生成相应的 TypeScript 类型定义：

> 你可以在 https://app.quicktype.io/ 自由尝试 Quicktype。

```typescript
interface User {
  id: number;
  name: string;
  address: Address;
}

interface Address {
  street: string;
  city: string;
}

// Awesome !
interface MyData {
  users: User;
  jsonata_cities: string[];
}
```

通过这种方式，我们可以快速获得清晰且准确的类型定义，确保在后续的数据处理和分析中保持一致性和正确性。

:::

## 总结

LibianCrawler 的数据清洗方案通过以下方式解决了传统方法的痛点：

- **存储层面：**
  - 使用 PostgreSQL 存储结构化数据，避免了 CSV 文件的 类型错误、字符集问题、CRLF 问题、体积管理问题。
  - 非结构化数据通过 MinIO 进行高效存储。
- **清洗层面：**
  - 基于 TypeScript 的类型系统，确保数据类型的准确性。
  - 结合 Jsonata 和 Quicktype，简化了复杂数据的处理和类型生成过程。

这种方案不仅提升了开发效率，还大幅降低了数据错误率，为后续的数据分析和使用奠定了坚实基础。
