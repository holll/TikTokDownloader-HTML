# CodeWhale 开发工作流指引

> 本文件作为全局 project instructions 加载。CodeWhale 在每次会话中会读取此文件作为行为参考。

## 开发 Skill 链路

进行任何程序开发任务时，请优先考虑以下 skill 流程。Skill 通过 description 自动匹配触发，也可用 `/skill <name>` 显式激活。

```
新功能/新组件
  └─ brainstorming ──→ writing-plans ──→ test-driven-development
                                            │
Bug 修复 / 异常排查                         │
  └─ systematic-debugging                   │
                                            │
多步骤复杂任务                              │
  └─ v4-best-practices ─────────────────────┘
                                            │
可并行子任务                                │
  └─ delegate
```

### 各 Skill 速查

| Skill | 触发时机 | 核心原则 |
|-------|---------|---------|
| `brainstorming` | 新功能、新组件、行为变更 | 先出设计并获批准，再写代码 |
| `writing-plans` | 设计确认后，编码前 | 拆成 2-5 分钟的 bite-sized 任务，含精确路径和代码 |
| `test-driven-development` | 任何功能实现或 bug 修复 | 先写失败测试，再看它失败，再写最小实现 |
| `systematic-debugging` | 任何 bug、测试失败、异常行为 | 找到根因之前不写修复 |
| `v4-best-practices` | 多步骤 / 计划驱动任务 | 引用前验证路径；多文件前 spawn 验证子代理 |
| `delegate` | 可拆分的并行读/写/测试 | 父代理保持架构判断，子代理做聚焦工作 |

## 行为准则

### 语言
- 默认使用简体中文思考和回复
- 代码、路径、命令保持原样

### 验证
- 文件修改后必须回读确认
- 命令执行后必须检查输出，不只看退出码
- 不声称"测试全通过"除非实际观察到通过结果

### 效率
- 独立操作并行执行（读文件、搜索、子代理）
- 不要串行化互不依赖的操作
- 上下文接近 60% 时主动建议 `/compact`

### 代码质量
- 优先复用、修复现有代码，而非新增
- 每个新文件、新依赖、新配置项都需要有存在的理由
- 完成后清理临时文件、脚手架代码
