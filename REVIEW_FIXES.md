# 跳跳经营记账小程序 — 代码审查修复指南

> 本文档由代码审查生成，按优先级排列，供 Claude Code 逐项修复。
> 项目根目录：`C:\Users\Administrator\Documents\drinkexpensetracker-miniapp`

---

## 修复优先级总览

| 优先级 | 数量 | 说明 |
|---|---|---|
| P0 立即修复 | 7 | 功能不可用 / 安全漏洞 / 数据错误 |
| P1 尽快修复 | 4 | 数据丢失 / 功能不完整 |
| P2 计划重构 | 4 | 可维护性 |
| P3 后续优化 | 7 | 体验/规范 |

---

## P0 — 立即修复

### P0-1 migrateRecords 云函数无限循环死锁

**文件**：`cloudfunctions/migrateRecords/index.js` 第48-81行

**问题**：当存在 ≥100 条无法匹配昵称的记录时，每次查询都返回同一批数据（它们的 `creatorOpenId` 始终不存在），全部走 skip 分支，`records.length === batchSize` 导致 `hasMore` 永远为 true，死循环直到云函数超时。

**当前代码**：
```js
while (hasMore) {
  const recordsRes = await transactionsCollection
    .where({ creatorOpenId: db.command.exists(false) })
    .limit(batchSize)
    .get()
  const records = recordsRes.data
  if (records.length === 0) { hasMore = false; break }

  for (const record of records) {
    if (record.creator && userMap[record.creator]) {
      await transactionsCollection.doc(record._id).update({
        data: { creatorOpenId: userMap[record.creator] }
      })
      totalMigrated++
    } else {
      totalSkipped++  // ❌ 这些记录下次还会被查到
    }
  }

  if (records.length < batchSize) { hasMore = false }
}
```

**修复方案**：对 skip 的记录也标记一个字段避免重复查询，或使用 skip 分页。推荐方案：

```js
let offset = 0
while (true) {
  const recordsRes = await transactionsCollection
    .where({ creatorOpenId: db.command.exists(false) })
    .skip(offset)
    .limit(batchSize)
    .get()
  const records = recordsRes.data
  if (records.length === 0) break

  for (const record of records) {
    if (record.creator && userMap[record.creator]) {
      await transactionsCollection.doc(record._id).update({
        data: { creatorOpenId: userMap[record.creator] }
      })
      totalMigrated++
    } else {
      // 标记为已尝试迁移，避免重复查询
      await transactionsCollection.doc(record._id).update({
        data: { creatorOpenId: 'unknown', migrateSkipped: true }
      })
      totalSkipped++
    }
  }
  offset += records.length
  if (records.length < batchSize) break
}
```

---

### P0-2 getTransactions reviewer 查询语法错误

**文件**：`cloudfunctions/getTransactions/index.js` 第35-40行

**问题**：微信云开发的 `or` 必须用 `db.command.or([...])`，直接写 `{ or: [...] }` 会被当作普通字段查询，reviewer 角色查不到数据。

**当前代码**：
```js
query = query.where({
  or: [
    { creatorOpenId: openId },
    { status: 'approved' }
  ]
})
```

**修复方案**：
```js
query = query.where(db.command.or([
  { creatorOpenId: openId },
  { status: 'approved' }
]))
```

---

### P0-3 getTransactions stats 查询条件覆盖 bug

**文件**：`cloudfunctions/getTransactions/index.js` 第150-172行

**问题**：链式调用 `.where()` 会覆盖之前的条件，而非叠加。日期条件被覆盖，统计返回全量数据。

**当前代码**：
```js
let todayQuery = db.collection(COLLECTION).where({ date: today })
// ...
if (isReviewer) {
  todayQuery = todayQuery.where(db.command.or(   // ❌ 覆盖了 date 条件
    { creatorOpenId: openId },
    { status: 'approved' }
  ))
}
```

**修复方案**：使用 `db.command.and()` 组合条件：
```js
let todayCondition = { date: today }
let monthCondition = { date: db.command.gte(monthStart) }

if (!isOwner && !isAdmin) {
  if (isReviewer) {
    const roleCondition = db.command.or([
      { creatorOpenId: openId },
      { status: 'approved' }
    ])
    todayCondition = db.command.and({ date: today }, roleCondition)
    monthCondition = db.command.and({ date: db.command.gte(monthStart) }, roleCondition)
  } else {
    todayCondition = { date: today, creatorOpenId: openId }
    monthCondition = { date: db.command.gte(monthStart), creatorOpenId: openId }
  }
}

const todayRes = await db.collection(COLLECTION).where(todayCondition).get()
const monthRes = await db.collection(COLLECTION).where(monthCondition).get()
```

---

### P0-4 前端直接读写数据库，绕过云函数权限

**文件**：`pages/index/index.js`

**问题位置**：
1. 第451-485行 `migrateGuestData`：前端直接 `db.collection('transactions').add()`
2. 第1496-1519行 `loadSettings`：前端直接读 settings 集合
3. 第1698-1717行 `saveSettings`：前端直接 `set()` 写入 settings

**风险**：用户可通过调试工具篡改任意数据，或写入非法 transactions 记录。

**修复方案**：
1. **访客数据迁移**：新增云函数 `migrateGuestData`，接收记录数组，在云函数端做参数校验后批量写入。前端改为调用该云函数。
2. **设置读写**：在 `login` 或 `manageUsers` 云函数中新增 `getSettings` / `saveSettings` action，前端统一走云函数。
3. **云开发控制台**：将 transactions 和 settings 集合的权限设置为"仅云函数可读写"。

---

### P0-5 manageUsers updateRole 未校验角色合法性

**文件**：`cloudfunctions/manageUsers/index.js` 第46-60行

**问题**：只校验非空，不校验取值范围，攻击者可传入 `newRole: 'owner'` 提权。

**修复方案**：
```js
const VALID_ROLES = ['owner', 'admin', 'reviewer', 'employee']
if (!targetUserId || !newRole) {
  return { success: false, error: '参数不完整' }
}
if (!VALID_ROLES.includes(newRole)) {
  return { success: false, error: '角色非法' }
}
```

---

### P0-6 getTransactions update 操作无参数校验

**文件**：`cloudfunctions/getTransactions/index.js` 第207-240行

**问题**：create 有完整校验，update 完全没有。amount 可为负数/字符串，date 可为任意格式，category 可为空。

**修复方案**：在 update 中复用 create 的校验逻辑：
```js
if (action === 'update') {
  const { recordId, category, amount, date, remark, supplier } = event

  // 参数校验（与 create 一致）
  if (typeof amount !== 'number' || amount <= 0 || amount > 99999999) {
    return { success: false, error: '金额非法' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: '日期格式错误' }
  }
  if (!category) {
    return { success: false, error: '请选择分类' }
  }
  // ... 后续逻辑不变
}
```

---

### P0-7 数据量上限硬编码 1000 条，无分页

**文件**：
- `cloudfunctions/getTransactions/index.js` 第46行
- `cloudfunctions/exportExcel/index.js` 第40行

**问题**：`.limit(1000)` 超过1000条后数据静默丢失，统计和导出不准确。

**修复方案**：实现分页循环查询：
```js
async function getAllRecords(collection, where) {
  const allData = []
  let offset = 0
  const pageSize = 100
  while (true) {
    const res = await collection.where(where).skip(offset).limit(pageSize).get()
    allData.push(...res.data)
    if (res.data.length < pageSize) break
    offset += pageSize
  }
  return allData
}
```

注意：云开发单次查询上限默认100条，需在云开发控制台配置上限或使用聚合查询。

---

## P1 — 尽快修复

### P1-1 doExport 函数死代码和变量名误导

**文件**：`pages/index/index.js` 第1366-1433行

**问题**：
```js
const csvContent = this.generateCSV(data);  // 生成了但从未使用
// ...
data: this.generateExcel(data),  // 实际写入的是 Excel XML
```

**修复方案**：删除 `csvContent` 变量和 `generateCSV` 方法（如果其他地方也不用），或统一使用 `generateExcelXML`。

---

### P1-2 reviewer 可审核自己创建的记录

**文件**：`cloudfunctions/getTransactions/index.js` 第96-143行

**问题**：approve/reject 操作没有禁止审核 `creatorOpenId === openId` 的记录。

**修复方案**：
```js
if (recordRes.data.creatorOpenId === openId) {
  return { success: false, error: '不能审核自己的记录' }
}
```

---

### P1-3 sendReminder 缺少定时触发器配置

**文件**：`cloudfunctions/sendReminder/config.json`

**问题**：没有 timers 触发器，日结提醒只能手动调用。

**修复方案**：在 config.json 中添加定时触发器：
```json
{
  "triggers": [
    {
      "name": "dailyReminderTimer",
      "type": "timer",
      "config": "0 0 21 * * * *"
    }
  ]
}
```
注意：定时触发时没有 openId，需要在云函数中遍历所有开启了提醒的用户发送。当前实现依赖 `event.action` 和 `openId`，需要重构为定时触发模式。

---

### P1-4 访客迁移记录缺少 status 字段

**文件**：`pages/index/index.js` 第470-485行（迁移到云函数后也需注意）

**问题**：迁移的记录没有 `status` 字段，列表中不显示审核状态。

**修复方案**：迁移时设置 `status: 'approved'`（或 `'pending'`，根据业务需求）。

---

## P2 — 计划重构

### P2-1 expense.js 和 income.js 95% 代码重复

**文件**：`pages/expense/expense.js`、`pages/income/income.js`

**问题**：两个文件几乎完全相同，仅类型变量不同。

**修复方案**：合并为一个 `pages/detail/detail.js`，通过 `options.type` 参数区分收入/支出，wxml/wxss 也合并。

---

### P2-2 工具函数重复实现

**重复位置**：
- `index.js` 中的 `formatDate`、`getMonthFirstDay`、`getTodayDate`、`generateUUID` 与 `utils/common.js` 重复
- `utils/format.js` 和 `utils/common.js` 各有一个 `formatDate`
- `exportExcel` 云函数中重新实现了 `escapeXml`，与 `utils/excel.js` 重复

**修复方案**：统一使用 `utils/common.js` 和 `utils/excel.js`，删除页面内的重复实现。云函数无法引用前端 utils，可在云函数目录下新建共享文件或接受少量重复。

---

### P2-3 index.js 单文件 2211 行

**文件**：`pages/index/index.js`

**问题**：单个页面承载记账表单、数据统计、Canvas图表、设置、员工管理、导出筛选、访客模式等全部逻辑。

**修复方案**：
- 设置弹窗 → 独立组件 `components/settings-panel`
- 员工管理 → 独立组件 `components/user-manage-panel`
- 导出筛选 → 独立组件 `components/export-filter-panel`
- 记账表单 → 独立组件 `components/record-form`
- Canvas 图表 → 独立组件 `components/chart-canvas`

---

### P2-4 云环境 ID 硬编码在 6+ 个文件中

**文件**：`app.js`、`utils/config.js`、`project.config.json`、全部6个云函数

**修复方案**：
- 云函数统一使用 `cloud.init()`（不指定 env，使用默认环境）
- 前端统一从 `utils/config.js` 读取 `CLOUD_ENV`
- `app.js` 中 `wx.cloud.init({ env: CLOUD_ENV })`

---

## P3 — 后续优化

### P3-1 app.js 启动时无用的数据库查询

**文件**：`app.js` 第11-16行

**问题**：`db.collection('transactions').count()` 仅用于 console.log，浪费冷启动调用。

**修复方案**：删除该测试代码。

---

### P3-2 wx.showLoading 未设置 mask

**问题**：全局 `wx.showLoading` 未设置 `mask: true`，加载期间用户可点击其他按钮导致重复提交。

**修复方案**：全局替换 `wx.showLoading({ title: '...' })` 为 `wx.showLoading({ title: '...', mask: true })`。

---

### P3-3 Canvas 图表固定像素尺寸

**文件**：`pages/index/index.js` 第1099-1103行、第1131-1133行

**问题**：硬编码 width=300/320, height=200/180，未适配不同屏幕。

**修复方案**：使用 `wx.getSystemInfoSync()` 动态计算，或使用 `wx.createSelectorQuery()` 获取容器实际尺寸。

---

### P3-4 project.config.json 中 urlCheck: false

**文件**：`project.config.json` 第12行

**修复方案**：上线前改为 `true`，确保域名合规。

---

### P3-5 分类数据仅存本地

**文件**：`utils/category.js`

**问题**：自定义分类用 `wx.setStorageSync` 保存，换设备或清缓存后丢失。

**修复方案**：在 users 集合中增加 `incomeCategories` 和 `expenseCategories` 字段，登录时同步到本地，修改时同步到云端。

---

### P3-6 云函数无 package-lock.json

**问题**：依赖版本不可控。

**修复方案**：在每个云函数目录下运行 `npm install` 生成 `package-lock.json` 并提交。

---

### P3-7 expense/income 页面导入未使用的函数

**文件**：`pages/expense/expense.js` 第6行、`pages/income/income.js` 第6行

**问题**：`getTodayDate`、`getMonthFirstDay`、`generateUUID`、`formatDate` 导入但未使用。

**修复方案**：清理未使用的导入。

---

## 修复执行顺序建议

1. **第一批（P0 安全/功能）**：P0-2, P0-3, P0-5, P0-6 → 语法和校验修复，风险低
2. **第二批（P0 架构）**：P0-4 → 前端直连数据库改云函数，改动较大需测试
3. **第三批（P0 数据）**：P0-1, P0-7 → 迁移和分页逻辑
4. **第四批（P1）**：全部 P1 项
5. **第五批（P2 重构）**：按模块逐步重构
6. **第六批（P3 优化）**：体验优化

---

## 注意事项

- 修复云函数后需重新上传部署
- P0-4 涉及数据库权限变更，需在云开发控制台同步修改集合权限
- P2-1 合并页面后需更新 `app.json` 的 pages 配置
- 所有修改建议在新分支上进行，测试通过后再合并
