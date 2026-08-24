# 修改日志 (Change Log)

## 2026-08-24 版本 1.1.0

### 新功能

| 功能 | 文件 | 说明 | 状态 |
|------|------|------|------|
| 手机号+密码注册 | login/index.js | 新用户手机号+密码注册 | ✅ |
| 手机号+密码登录 | login/index.js | 支持账号密码登录 | ✅ |
| 微信一键登录 | login/index.js | 微信授权获取手机号 | ✅ |
| 忘记密码 | login/index.js | 邮箱找回密码 | ✅ |
| 注册审核 | manageUsers/index.js | 管理员审核新用户 | ✅ |
| 绑定手机号 | bindPhone | 微信登录后绑定手机号 | ✅ |
| 更换手机号 | manageUsers/index.js | 用户可更换手机号 | ✅ |

### 新增页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录页 | pages/login/ | 手机号+密码/微信登录 |
| 注册页 | pages/register/ | 新用户注册 |
| 忘记密码页 | pages/forgot/ | 邮箱找回密码 |
| 重置密码页 | pages/reset/ | 设置新密码 |
| 绑定手机号 | pages/bindPhone/ | 微信登录后绑定 |

### 安全修复

| 问题 | 文件 | 修复内容 | 状态 |
|------|------|---------|------|
| 微信一键登录参数缺失 | login/index.js | 支持code参数获取手机号 | ✅ |
| approveUser重复审核 | manageUsers/index.js | 添加pending状态检查 | ✅ |
| 拒绝状态语义不清 | manageUsers/index.js | 拒绝改为rejected状态 | ✅ |

---

## 2026-08-22 版本 1.0.5

### 安全修复

| 问题 | 文件 | 修复内容 | 状态 |
|------|------|---------|------|
| sendReminder缺少权限验证 | sendReminder/index.js | 添加owner/admin权限检查 | ✅ |
| transferOwner缺少事务保护 | manageUsers/index.js | 添加db.startTransaction() | ✅ |
| 硬编码模板ID | utils/config.js | 移除TEMPLATE_ID常量 | ✅ |
| 审核通过记录保护 | getTransactions/index.js | 已有正确实现 | ✅ |

### 权限修复

| 问题 | 文件 | 修复内容 | 状态 |
|------|------|---------|------|
| 导出功能只允许owner | exportExcel/index.js | 改为允许owner和admin | ✅ |
| migrateRecords只允许owner | migrateRecords/index.js | 改为允许owner和admin | ✅ |
| settings保存覆盖全部数据 | pages/index/index.js | 改用update只更新字段 | ✅ |

---

## 2026-08-21/22 版本 1.0.4

### 安全修复

| 问题 | 文件 | 修复内容 | 状态 |
|------|------|---------|------|
| migrateRecords无限循环死锁 | migrateRecords/index.js | 使用offset分页，避免死循环 | ✅ |
| reviewer查询语法错误 | getTransactions/index.js | 使用db.command.or()正确语法 | ✅ |
| stats查询条件覆盖 | getTransactions/index.js | 使用db.command.and()组合条件 | ✅ |
| update参数校验缺失 | getTransactions/index.js | 添加category/amount/date校验 | ✅ |
| 审核通过记录可修改/删除 | getTransactions/index.js | 添加status检查禁止操作 | ✅ |
| 角色修改缺乏值校验 | manageUsers/index.js | 添加newRole白名单验证 | ✅ |
| 删除用户未检查目标角色 | manageUsers/index.js | 禁止删除店长账号 | ✅ |
| 前端record未检查 | index.js | editRecord/deleteRecord添加存在检查 | ✅ |

### 功能修复

| 问题 | 文件 | 修复内容 | 状态 |
|------|------|---------|------|
| reviewer可审核自己记录 | getTransactions/index.js | 添加creatorOpenId检查 | ✅ |
| 访客迁移记录缺status | index.js | 迁移时添加status:'approved' | ✅ |
| doExport死代码 | index.js | 删除未使用的generateCSV | ✅ |
| app.js无用数据库查询 | app.js | 删除测试代码 | ✅ |

### 新增功能

| 功能 | 文件 | 说明 | 状态 |
|------|------|------|------|
| sendReminder定时触发器 | sendReminder/config.json | 每天21:00自动提醒 | ✅ |
| 数据分页支持 | getTransactions/index.js | getAllRecords支持超1000条 | ✅ |

### 权限系统

| 角色 | 标识 | 说明 |
|------|------|------|
| 店长 | owner | 最高权限，管理员工 |
| 管理员 | admin | 管理所有数据 |
| 审核员 | reviewer | 审核记录 |
| 录入员 | employee | 录入自己的记录（默认） |

---

## 2026-08-16

### 代码审查与安全修复

#### 安全漏洞修复
- **修复**: 用户查询方式从 `where({_openid: openId})` 改为 `doc(openId).get()`
- **问题**: 原方式查询不到用户，导致店长操作失败
- **文件**: `cloudfunctions/manageUsers/index.js`

#### getUserProfile API 废弃修复
- **修复**: 改用 `button` 组件的 `open-type="getUserInfo"`
- **文件**: `pages/index/index.wxml`, `pages/index/index.js`
- **状态**: ✅ 已完成

#### 模板 ID 配置优化
- **修复**: 模板 ID 改为从数据库 settings 集合动态获取
- **新增**: 设置页面添加模板 ID 输入框
- **文件**: `cloudfunctions/sendReminder/index.js`, `pages/index/index.wxml`, `pages/index/index.js`

#### 代码质量优化
- **新增**: `utils/common.js` 公共函数库
- **包含**: getMonthLastDay, getTodayDate, getMonthFirstDay, generateUUID, formatDate
- **优化**: expense.js 和 income.js 引入公共函数，减少代码重复

### 员工管理功能重构

#### 简化登录流程
- **新流程**: 用户自己登录 → 自动注册为 employee → 店长在后台修改角色
- **删除**: createEmployee, claimEmployee action（验证码认领流程）
- **保留**: list, updateRole, toggleStatus, resetEmployeeData, remove, setPermissions

#### 角色权限矩阵（最终版）
| 操作 | 录入员 | 审核员 | 管理员 | 店长 |
|------|--------|--------|--------|------|
| 录入自己的数据 | ✅ | ✅ | ✅ | ✅ |
| 查看自己的数据 | ✅ | ✅ | ✅ | ✅ |
| 编辑自己的数据 | ✅ | ✅ | ✅ | ✅ |
| 删除自己的数据 | ❌ | ✅ | ✅ | ✅ |
| 查看他人数据 | ❌ | ✅ | ✅ | ✅ |
| 编辑他人数据 | ❌ | ❌ | ✅ | ✅ |
| 删除他人数据 | ❌ | ❌ | ✅ | ✅ |
| 审核数据 | ❌ | ✅ | ✅ | ✅ |
| 导出数据 | ❌ | ✅ | ✅ | ✅ |
| 管理员工 | ❌ | ❌ | ❌ | ✅ |

### 其他优化

#### 代码审查修复的问题
| 问题 | 修复 | 状态 |
|------|------|------|
| 分类筛选逻辑错误 | 修复 `selectedCategories.length > 0` 判断 | ✅ |
| XSS 转义不完整 | 完善 exportExcel 的 escapeXml 函数 | ✅ |
| 缺少 complete 回调 | 添加 complete 确保 hideLoading 执行 | ✅ |
| 请求乱序问题 | prevMonth/nextMonth 添加 loading 检查 | ✅ |
| WXSS 重复定义 | 合并 expense.wxss 的 .filter-title | ✅ |
| initOwner 密钥泄露 | 删除 initOwner 云函数 | ✅ |

#### 项目名称更新
- **修改**: "餐饮店经营记账" → "跳跳经营记账"
- **文件**: `app.json`, `project.config.json`, `pages/index/index.js`

#### 新增按需组件注入
- **文件**: `app.json`
- **配置**: `"lazyCodeLoading": "requiredComponents"`

---

## 2026-08-13

### 代码优化 (Phase 1)

#### 云函数安全修复
- **文件**: `cloudfunctions/getTransactions/index.js`
- **修复**:
  - 添加权限验证（openId 检查）
  - 非店长用户只能查看自己的记录
  - 添加 `update`, `delete` action 替代客户端操作
  - 记录上限从 100 改为 1000

#### 导出功能安全修复
- **文件**: `cloudfunctions/exportExcel/index.js`
- **修复**:
  - 添加权限验证（只有店长可以导出）
  - 记录上限从 100 改为 1000
  - 添加供应商字段到 Excel 导出

#### 分类筛选 Bug 修复
- **文件**: `pages/expense/expense.js`, `pages/income/income.js`
- **问题**: 使用硬编码的分类数组长度判断，导致自定义分类无法筛选
- **修复**: 改为使用 `allCategories.length` 动态判断

#### 删除死代码
- **文件**: `pages/index/index.js`
- **问题**: 存在未使用的 `login()` 方法（第一个）
- **修复**: 删除重复的 login 方法

### Bug 修复

#### 修复登录云函数创建用户失败
- **文件**: `cloudfunctions/login/index.js`
- **问题**: `doc().set()` 时 `data` 中包含 `_id` 字段导致 `invalid parameters` 错误
- **修改内容**: 移除 `newUser` 对象中的 `_id` 字段（`_id` 由 `doc(openId)` 指定）
- **状态**: ✅ 已完成
- **错误信息**: `invalid parameters. 不能更新_id的值`
- **解决方法**: 需要重新上传 `login` 云函数

#### 修复默认头像图片不存在问题
- **文件**: `pages/index/index.wxml`, `pages/index/index.js`, `pages/index/index.wxss`
- **问题**: `/images/default-avatar.png` 图片文件不存在，导致 500 错误
- **修改内容**:
  - 移除对本地图片文件的依赖
  - 改用纯色背景 + 用户昵称首字母作为默认头像
  - 根据昵称首字符的 ASCII 码选择不同颜色的头像（8种颜色循环）
- **状态**: ✅ 已完成

#### 配置订阅消息模板 ID
- **文件**: `pages/index/index.js`, `cloudfunctions/sendReminder/index.js`
- **内容**: 将模板 ID 替换为真实 ID `0l7u3J5zj2FTqTAILAlY-ml-GerUpaM2f9lyiLSHsSc`
- **状态**: ✅ 已完成

#### 修复导出功能（shareFileMessage 限制问题）
- **文件**: `pages/index/index.js`
- **问题**: `wx.shareFileMessage` 只能在用户点击事件处理函数中直接调用，无法在异步回调中使用
- **修改内容**:
  - 所有导出功能改用 `wx.openDocument` 打开文件
  - 改用 Excel 格式 (.xls) 替代 CSV
  - 用户可在打开的文档页面使用微信内置分享功能
- **状态**: ✅ 已完成

#### 修复导出本月数据功能
- **文件**: `pages/index/index.js`
- **问题**: 用户未切换到"数据"Tab时，`monthData`为空，导致导出失败
- **修改内容**:
  - 导出前检查数据是否已加载
  - 数据为空时自动从云函数获取当月数据
  - 拆分出 `doExportMonthCSV` 函数专门处理 CSV 生成和导出
- **状态**: ✅ 已完成

#### 修复订阅消息模板 ID 未配置问题
- **文件**: `pages/index/index.js`, `cloudfunctions/sendReminder/index.js`
- **问题**: 模板 ID `YOUR_TEMPLATE_ID` 为占位符，导致 `errCode: 20001` 错误
- **修改内容**:
  - 前端：点击测试提醒时检测模板 ID 是否为占位符，如果是则弹出配置提示
  - 云函数：模板 ID 未配置时返回明确的错误信息
- **状态**: ✅ 已完成

### 新增功能

#### 支出明细页面
- **新增文件**:
  - `pages/expense/expense.js` - 支出明细页面逻辑
  - `pages/expense/expense.wxml` - 支出明细页面模板
  - `pages/expense/expense.wxss` - 支出明细页面样式
- **功能说明**:
  - 独立的支出明细页面，支持月份切换
  - 显示当月总支出和分类统计
  - 支持按分类筛选
  - 可导出支出明细为 Excel
- **入口**: 首页 Tab 切换中的"支出"Tab，或点击"查看详细支出明细"
- **状态**: ✅ 已完成

#### 收入明细页面
- **新增文件**:
  - `pages/income/income.js` - 收入明细页面逻辑
  - `pages/income/income.wxml` - 收入明细页面模板
  - `pages/income/income.wxss` - 收入明细页面样式
- **功能说明**:
  - 独立的收入明细页面，支持月份切换
  - 显示当月总收入和分类统计
  - 支持按分类筛选
  - 可导出收入明细为 Excel
- **入口**: 首页 Tab 切换中的"收入"Tab
- **状态**: ✅ 已完成

#### 支出记录添加供应商名称
- **文件**: `pages/index/index.wxml`, `pages/index/index.js`
- **功能**: 记支出时新增"供应商"字段
- **状态**: ✅ 已完成

#### 更新收入分类
- **文件**: `pages/index/index.js`, `pages/income/income.js`
- **新分类**: 收钱吧、美团团购、抖音团购、现金、美团外卖、淘宝外卖、京东外卖、其他外卖、废品、废油、其他
- **状态**: ✅ 已完成

#### 合并收支明细 Tab
- **文件**: `pages/index/index.wxml`, `pages/index/index.js`, `pages/index/index.wxss`
- **修改内容**:
  - 将原来的"收入"和"支出"两个 Tab 合并为"明细"一个 Tab
  - 明细 Tab 内可切换"收入"/"支出"类型
  - 点击按钮跳转到对应的详细页面
- **Tab 结构**: 记账 → 数据 → 明细
- **状态**: ✅ 已完成

#### 数据迁移功能
- **文件**: `cloudfunctions/migrateRecords/` (新增云函数)
- **功能**: 为没有 `creatorOpenId` 的旧记录补充字段，基于 `creator` 昵称匹配用户 openId
- **使用方式**: 店长登录后，在设置页面点击"数据迁移"按钮
- **状态**: ✅ 已完成

### Bug 修复

#### 修复权限验证依赖昵称问题
- **文件**: `pages/index/index.js`
- **问题**: 员工权限通过 `record.creator !== userInfo.nickName` 判断，用户改名后可能失去编辑自己记录的权限
- **修改内容**:
  - 登录逻辑：保存 `openId` 到 `userInfo` 对象和本地存储
  - 创建记录：新增 `creatorOpenId` 字段存储创建人的 openId
  - `editRecord` 权限检查：`record.creator !== nickName` → `record.creatorOpenId !== openId`
  - `deleteRecord` 权限检查：`record.creator !== nickName` → `record.creatorOpenId !== openId`
- **状态**: ✅ 已完成

#### 修复记录列表字段名不匹配问题
- **文件**: `pages/index/index.wxml`
- **问题**: WXML 中使用 `item.id`，但数据库返回的记录主键是 `item._id`，导致编辑和删除功能无法正常工作
- **修改内容**:
  - 第93行: `wx:key="id"` → `wx:key="_id"`
  - 第93行: `data-id="{{item.id}}"` → `data-id="{{item._id}}"`
  - 第104行: `data-id="{{item.id}}"` → `data-id="{{item._id}}"`
- **状态**: ✅ 已完成

### 代码检查通过

| 检查项 | 状态 |
|--------|------|
| WXML `item.id` → `item._id` | ✅ 已修复 |
| `editRecord` 权限检查 | ✅ 已修复（改用 openId） |
| `deleteRecord` 权限检查 | ✅ 已修复（改用 openId） |
| `submitForm` 新增/编辑逻辑 | ✅ 正常 |

### 已发现但未处理的问题

1. ~~**环境 ID 硬编码**~~ ✅ 已优化
   - 新增 `utils/config.js` 统一管理配置
   - 云环境 ID: `cloud1-d6gqwroxrc08ea02c`
   - 模板 ID: `0l7u3J5zj2FTqTAILAlY-ml-GerUpaM2f9lyiLSHsSc`

2. ~~**订阅消息模板 ID 未配置**~~ ✅ 已配置
   - 已在 `cloudfunctions/sendReminder/index.js` 中配置真实模板 ID
   - openId 改从 `wxContext` 获取，修复安全漏洞

---

## 2026-08-13 Phase 2 & Phase 3 优化

### Phase 2: 加载状态与图表颜色优化

#### 添加 calculateStats 加载状态
- **文件**: `pages/index/index.js`
- 添加 `statsLoading` 数据字段
- 云函数调用前后设置加载状态

#### 统一图表颜色配置
- **文件**: `utils/format.js`
- 新增 `CHART_COLORS` 共享常量
- 各页面通过 `require('../../utils/format.js')` 导入

### Phase 3: 代码去重与工具模块

#### 新增工具文件
| 文件 | 功能 |
|------|------|
| `utils/config.js` | 配置管理（云环境 ID、模板 ID、默认分类） |
| `utils/category.js` | 分类管理（获取/保存/添加分类） |
| `utils/excel.js` | Excel 生成（生成 XML、下载文件） |

#### sendReminder 安全修复
- **文件**: `cloudfunctions/sendReminder/index.js`
- openId 改从 `wxContext` 获取，移除客户端传入参数

### Phase 3 重构完成

#### 页面重构 - 使用工具模块
- **pages/index/index.js**
  - 引入 `DEFAULT_INCOME_CATEGORIES`, `DEFAULT_EXPENSE_CATEGORIES` 从 config.js
  - `generateExcel()` 简化为调用 `generateExcelXML()`
  - `doExportMonthCSV()` 简化为调用工具函数

- **pages/expense/expense.js**
  - `loadSavedCategories()` → 使用 `getExpenseCategories()`
  - `addCategory()` → 使用 `addExpenseCategory()`
  - `exportExpense()` → 使用 `generateExcelXML()` + `downloadExcel()`

- **pages/income/income.js**
  - `loadSavedCategories()` → 使用 `getIncomeCategories()`
  - `addCategory()` → 使用 `addIncomeCategory()`
  - `exportIncome()` → 使用 `generateExcelXML()` + `downloadExcel()`

---

## 历史记录格式

每次修改请在本文档顶部添加新记录，格式如下：

```
## YYYY-MM-DD

### 功能/修复类型

#### 标题
- **文件**: 文件路径
- **问题描述**: ...
- **修改内容**: ...
- **状态**: ✅ 已完成 / 🔄 进行中 / ⏸️ 待处理
```
