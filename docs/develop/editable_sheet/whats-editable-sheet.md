# 1. 什么是可编辑表

在数据清洗时，NocoDB 只是提供了便捷的预览视图功能。

而现在则需要发挥 NocoDB 的全部实力 —— 便捷的人工修改 + 自动化的更新修改 + NocoDB WebHook ，因此 可编辑表 是基于 NocoDB 的 API 的流水线。

## 不同字段的故事

可以将各种字段按这几类特性来分类：

* Data/Computed
    * 按来源分类
        * 数据源中的 Data
            * nocodb 其他 table 中的克隆字段
                * 伪 Computed（在 CleanerCI 中已经清洗并计算完成的）
            * N8N 或其他平台所调用 nocodb api 控制的 Data
        * 运维在 nocodb 手动管理的 Data
            * 运维手动标注的 Data（例如: nocodb 中的标签（已处理、未处理）、 处理人（nocodb用户））
        * 简易 Computed（未在 CleanerCI 中）
        * 复杂 Computed（在第 `x` 次清洗之后 `(x>=1)`，读取结果中的数据，输出新的结果）
            * 昂贵并应该被缓存的（例如: nocodb 图片上传、大模型输出、图片OCR）
            * 递归联表多条件查询（例如: 论文对应的期刊信息、期刊的当年的影响因子）
    * Computed 过程可公开/不可公开

        