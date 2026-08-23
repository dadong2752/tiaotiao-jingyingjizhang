# 跳跳经营记账小程序 — 安全与 Bug 审查报告

**审查日期**：2026-08-16
**审查人**：WorkBuddy
**审查范围**：全部源码（6 个云函数 + 3 个页面 + 5 个 utils + 配置）
**结论安全评级**：🔴 高风险（严重权限绕过 + 多个功能性 Bug）

> 重要说明：项目内已有的 `REVIEW.md`（标注"主要安全漏洞已修复，安全评级中等偏上"）**与真实代码严重不符**，存在模板式/幻觉内容（例如它声称存在一个 76 行的 `getUserProfile` 函数、声称写入已改走服务端校验）。本报告基于**实际代码**重新审查，结论以前者为准。

---

## 一、最严重的发现（必须优先处理）

### 🔴 C1｜客户端直接写库，服务端权限校验形同虚设（越权 + 数据可被篡改/删除/读取全量）

核心问题：记账、删除、设置等**写操作在客户端直接用 `wx.cloud.database()` 完成**，完全绕过了云函数里的权限判断。

涉及位置：
- `pages/index/index.js:639` `db.collection('transactions').doc(editingId).update(...)` —— 编辑记录
- `pages/index/index.js:662` `db.collection('transactions').add(...)` —— 新增记录
- `pages/index/index.js:834` `db.collection('transactions').doc(id).remove(...)` —— 删除记录
- `pages/index/index.js:468`（`migrateGuestData`）+ `:1571`（`saveSettings`）—— 访客迁移、设置写库
- `cloudfunctions/getTransactions/index.js` 里的 `update`/`delete` 权限校验**是死代码**——客户端从不调用它们，只走上面的客户端直写路径

直接后果（只要数据库写权限是 `auth != null`，而这些操作能跑就说明必然是开放的）：
1. **任意用户可改/删任意人的记录**：UI 里的 `record.creatorOpenId !== openId` 检查只是前端判断，攻击者在微信开发者工具或抓包里直接调用 DB SDK、传入任意 `_id` 即可越权修改/删除店长或其他员工的记录。
2. **可伪造 `creatorOpenId` / `creator` / `amount`**：新增记录的归属字段由客户端提供，可被篡改为他人名下，金额可填负数或任意值。
3. **可读全量数据**：员工本应只见自己数据（`getTransactions` 服务端已做 `where creatorOpenId = openId` 限制），但用 DB SDK 直接 `.get()` 可绕过，拉走全部人的经营数据。

> 好消息：服务端 `getTransactions` 的"店长/员工"隔离逻辑、`exportExcel` 的店长限制、`manageUsers` 的店长限制都写得对，只是**写路径没走这些云函数**，等于被架空。修复成本可控（见第七部分）。

### 🔴 C2｜数据库安全规则必然开放，且无服务端写入口

因为 C1 的客户端直写要能运行，`transactions` / `settings` 集合的安全规则大概率是 `"read":"auth != null","write":"auth != null"`（云开发集合的默认/常见配置）。这正是 C1 能成立的前提，也是风险放大器。

**必须**：把所有写操作改为云函数，并把集合的 `write` 规则设为"仅云函数可写"（或自定义规则拒绝客户端直写），让 C1 的越权路径从根上消失。

### 🔴 C3｜缺少"首店长"引导机制，整个角色系统实际上不可用

- `cloudfunctions/login/index.js:60` 新用户一律 `role: 'employee'`。
- `cloudfunctions/manageUsers/index.js:25` 只有 `role === 'owner'` 才能提拔别人。
- 会话记录显示 `initOwner` 云函数已在 2026-08-15 **被删除**。

三者在逻辑上形成死锁：**没有任何应用内途径能产生第一个 owner**。结果：员工管理、Excel 导出（owner 专属）、异常预警等全部店长功能，除非你已在云控制台手动把某个 `_id` 改成 owner，否则谁都用不了。这既是个严重功能缺陷，也意味着 C1/C2 的权限隔离在当前根本没人能管理。

---

## 二、功能性 Bug（会导致崩溃或数据错误）

### 🟠 B1｜`getUserProfile` 被调用却从未定义 —— 登录流程崩溃
- `pages/index/index.wxml:40` `<text bindtap="getUserProfile">登录</text>`（访客提示条）
- `pages/index/index.js:322` `this.getUserProfile()`（`checkLoginAndProceed` 里点"登录"）

全文件（含末尾 `removeUser`）**没有定义 `getUserProfile`**。点这两处"登录"会抛 `TypeError: this.getUserProfile is not a function`，登录入口直接断掉。主入口"点击登录"按钮走的是 `onGetUserInfo`（可用），但两条次要登录路径已坏。

### 🟠 B2｜导出的 Excel（XML）未对 `date`/`category`/`supplier` 转义 —— 文件损坏
- `utils/excel.js:49` 把 `${item.date}`、`${item.category}` 直接拼进 XML；`item.supplier` 在 `:47` 也未转义；`remark` 只转义了 `<` `>`（`:46`），漏了 `&` `"` `'`。
- `cloudfunctions/exportExcel/index.js:97-100` 同样：`item.date`、`item.category`、`supplier` 未转义，仅 `remark` 转义。

分类来自用户输入（`addExpenseCategory`/`addIncomeCategory` 接受任意文本），所以只要有人建了一个含 `&` `<` `>` 的分类（如"采购&A""C<D"），导出的 `.xls` 就是非法 XML，Excel/WPS 打不开或乱码。

### 🟠 B3｜`sendReminder` 使用云函数本地时区，与中国时区偏差 8 小时
`cloudfunctions/sendReminder/index.js:22-23` 用 `new Date()` 的 `getFullYear/Month/Date` 算"今日"。微信云函数 Node 运行时默认 **UTC**，北京时间 08:00 前它算的是前一天。结果：日结提醒的"今日收入/支出"会算错一天；`checkAbnormal` 的"今日大额/亏损"也按错误日期统计。而 `getTransactions` 的 stats 用的是客户端传的北京时间，两边口径不一致。

### 🟠 B4｜`settings` 集合读写不一致，多用户互相覆盖
- 客户端 `saveSettings`（`index.js:1571`）`db.collection('settings').add/update` **不按 `_openid` 区分**，先 `.get()` 取 `[0]` 再改——谁先存设置，谁的文档就成了"全局设置"，后续所有人的保存都改到这同一篇。
- `sendReminder`（`sendReminder/index.js:40,79`）却按 `{_openid: openId}` 查设置 —— 与上面的写入口径对不上，提醒经常读不到对应用户的配置。
- `REVIEW.md` 里写的"settings._id = openId 每用户一份"在代码里**根本没实现**。

---

## 三、中危 / 设计失真

| 问题 | 位置 | 说明 |
|---|---|---|
| 角色模型实际只有"店长 vs 其他人"两级 | `getTransactions`/`manageUsers`/`index.js` | `admin`/`reviewer` 在 UI 和权限矩阵里都有，但代码里**任何非 owner 检查都只比 `role==='owner'`**，admin/reviewer 与 employee 权限完全相同。`REVIEW.md` 的权限矩阵是虚构的。 |
| `setPermissions` 是死代码，精细权限未生效 | `manageUsers/index.js:118` | `permissions` 字段写进库但从不被任何地方读取/校验。 |
| 金额等无服务端校验 | `getTransactions` update、`submitForm` | 校验只在客户端 `isValidForm`（`index.js:605`），直写路径下服务器不校验 `amount` 正负/范围、`type`、`date` 格式。 |
| `getUserInfo` 已废弃 | `index.js:13` `open-type="getUserInfo"` | 微信基础库 2.21+ 返回**匿名昵称（"微信用户"）+ 灰色默认头像**，真正资料需 `getUserProfile`（新版又改 `chooseAvatar`+昵称输入框）。现在登录后拿到的是假资料。 |
| 模板 ID 仍硬编码 | `utils/config.js:7` | `REVIEW.md` 说"要存入数据库 settings"，实际仍是常量。 |
| `exportExcel` 日期过滤写法需验证 | `exportExcel/index.js:33` | `db.command.and(gte, lte)` 的传参方式在不同 SDK 版本行为不一致，且**只在 `startDate && endDate` 同时传入时才过滤**，否则返回全部（最多 1000 条，超量会丢数据）。 |
| 导出实现重复三套 | `index.js` `doExport`/`doExportFiltered`/`exportMonthData`、`excel.js`、`exportExcel` 云函数 | 逻辑分散，修复转义/格式要改多处，易遗漏。 |

---

## 四、低危 / 代码质量

- `downloadExcel`（`excel.js:78`）固定文件名 `export_<date>.xls`，多次导出互相覆盖。
- `app.js:12` 每次冷启动都 `db.collection('transactions').count()`，纯属多余读。
- 昵称无长度/内容限制；列表无分页（`getTransactions` 硬 `limit(1000)`）。
- 云存储 `exports/`（exportExcel 上传）从不清理，长期产生存储费用。
- `expense.js` / `income.js` 约 150 行逻辑重复，应抽到公共模块。
- `project.config.json:12` `urlCheck:false` 关闭了域名校验（仅影响开发者工具，不进生产，但建议保持开启以便提前暴露配置问题）。

---

## 五、已做对的地方（保留）

- 云函数统一用 `cloud.getWXContext()` 取 openid，不信任客户端传的身份。✅
- `getTransactions` 的读路径、按 owner/employee 隔离、金额分单位存储（int 分）。✅
- `exportExcel`/`manageUsers`/`migrateRecords` 的"仅店长"判断逻辑正确。✅
- 云函数 `config.json` 未开 `openaccess`，不会被公网 HTTP 直接调用。✅

---

## 六、修复建议（按优先级）

### P0 — 堵住越权（C1/C2）
1. **所有写操作改走云函数**：
   - 新增 `cloudfunctions/transactions`（或扩展 `getTransactions`）的 `create`/`update`/`delete` 动作，`creatorOpenId` **强制取 `wxContext.OPENID`**（绝不收客户端传入的归属），并做字段校验。
   - 客户端 `submitForm`/`deleteRecord`/`migrateGuestData` 改为 `wx.cloud.callFunction` 调用，删掉 `wx.cloud.database().add/update/remove`。
2. **收紧数据库安全规则**：`transactions`/`settings`/`users` 的 `write` 设为"仅云函数"（客户端不可写）；`read` 也尽量经云函数，或在规则里按 `_openid` 限制。
3. **owner 引导**：推荐方案——首个注册用户自动成为 owner，或读取云函数环境变量 `OWNER_OPENID`；避免再次出现"无 owner"死锁。

### P1 — 修崩溃与数据错误（B1–B4）
4. 删除/实现 `getUserProfile`：把 `index.wxml:40` 和 `checkLoginAndProceed` 两处改为调用已存在的 `onGetUserInfo` 登录流程（或实现真正的 `getUserProfile`）。
5. 抽一个统一 XML 转义函数（转义 `& < > " '`），`utils/excel.js` 与 `exportExcel` 云函数共用，覆盖 `date`/`category`/`supplier`/`remark`/`sheetName`。
6. `sendReminder` 改用固定北京时间：`new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year/Month/day})` 或显式 `+8h` 计算 `today`。
7. `settings` 以 `_openid` 为文档 `_id`，读写都按当前用户定位，消除互相覆盖。

### P2 — 健壮性
8. 服务端对 `amount`/`type`/`date`/`category` 做校验；`update` 动作补全缺失的校验。
9. 升级登录：用 `chooseAvatar` + 昵称输入替代废弃 `getUserInfo`；`saveProfile` 同步更新。
10. 模板 ID 等配置入库或走环境变量，去除硬编码。
11. 合并三套导出逻辑；`exportExcel` 验证 `db.command.and` 写法并支持分页/游标。

### P3 — 清理
12. 删除 `doExport` 死代码；`app.js` 去掉无谓 `count()`；`exports/` 定期清理；昵称加 `maxlength`；`expense/income` 去重。

---

## 七、关键修复示范代码

**① 统一 XML 转义（utils/excel.js 顶部）**
```js
function escapeXml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// 行 49 改为：
excel += `<Row><Cell><Data ss:Type="String">${escapeXml(item.date)}</Data></Cell>
<Cell><Data ss:Type="String">${type}</Data></Cell>
<Cell><Data ss:Type="String">${escapeXml(item.category)}</Data></Cell>
${supplier ? `<Cell><Data ss:Type="String">${escapeXml(item.supplier)}</Data></Cell>` : ''}
<Cell><Data ss:Type="Number">${amount}</Data></Cell>
<Cell><Data ss:Type="String">${escapeXml(item.remark)}</Data></Cell></Row>`;
```

**② 新增交易的云函数骨架（creatorOpenId 取服务端身份，强制校验）**
```js
// cloudfunctions/getTransactions/index.js  新增 action === 'create'
if (action === 'create') {
  const { type, category, amount, date, remark, supplier } = event;
  if (!['income','expense'].includes(type)) return { success:false, error:'类型非法' };
  if (typeof amount !== 'number' || !(amount > 0) || amount > 99999999)
    return { success:false, error:'金额非法' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success:false, error:'日期格式错误' };
  const creatorOpenId = wxContext.OPENID || wxContext.openId; // 关键：不收客户端
  await db.collection(COLLECTION).add({
    data: { _id: generateUUID(), type, category, amount: Math.round(amount),
            date, remark: remark||'', supplier: supplier||'', createTime: Date.now(),
            creatorOpenId, creator: (await db.collection('users').doc(creatorOpenId).get()).data?.nickName || '' }
  });
  return { success:true, message:'记账成功' };
}
```

**③ owner 引导（login 云函数）**
```js
// 在"用户不存在，自动创建"分支：
const userCount = await usersCollection.count();
const newUser = {
  _id: openId, nickName: nickName || '用户', avatarUrl: avatarUrl || '',
  role: userCount.total === 0 ? 'owner' : 'employee', // 首个注册用户即店长
  status: 'enabled', createTime: Date.now()
};
```

---

## 八、一句话总结

代码"服务端权限设计"其实写得不错，但**客户端绕过了它直接写库**，导致权限隔离形同虚设（C1/C2），且因删除了 owner 引导、登录函数未定义等，整体可用性也有硬伤。先把写操作收归云函数 + 收紧数据库规则 + 补 owner 引导，风险即可从"高"降到"低"；其余为转义、时区、设置覆盖等明确 Bug，按 P1 逐项修即可。

需要我直接动手修其中某几项（建议先做 C1/C2/B1/B2），告诉我即可，我可以改完代码并自测。
