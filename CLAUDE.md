# 跳跳经营记账小程序

餐饮记账小程序，支持多员工、审核流程、数据统计、导出等功能。

## 技术栈

- **前端**：微信小程序（WXML/WXSS/JS）
- **后端**：微信云开发（云函数 + 云数据库）
- **环境**：cloud1-d6gqwroxrc08ea02c

## 项目结构

```
├── app.js                    # 小程序入口
├── app.json                  # 小程序配置
├── app.wxss                  # 全局样式
├── cloudfunctions/           # 云函数
│   ├── login/                # 登录云函数
│   ├── getTransactions/      # 收支记录云函数
│   ├── manageUsers/          # 用户管理云函数
│   ├── exportExcel/          # 导出Excel云函数
│   ├── sendReminder/         # 提醒云函数
│   └── migrateRecords/       # 数据迁移云函数
├── pages/                    # 页面
│   ├── index/                # 首页（记账/数据/明细）
│   ├── expense/               # 支出明细页
│   └── income/               # 收入明细页
├── utils/                    # 工具函数
│   ├── config.js             # 配置（分类等）
│   ├── format.js             # 格式化工具
│   ├── excel.js              # Excel导出工具
│   ├── category.js            # 分类工具
│   └── common.js             # 通用工具
└── project.config.json       # 项目配置
```

## 权限系统

### 角色

| 角色 | 标识 | 说明 |
|------|------|------|
| 店长 | owner | 最高权限，管理员工 |
| 管理员 | admin | 管理所有数据 |
| 审核员 | reviewer | 审核记录 |
| 录入员 | employee | 录入自己的记录 |

### 权限矩阵

| 操作 | 录入员 | 审核员 | 管理员 | 店长 |
|------|--------|--------|--------|------|
| 录入数据 | ✅ | ✅ | ✅ | ✅ |
| 查看自己的数据 | ✅ | ✅ | ✅ | ✅ |
| 审核数据 | ❌ | ✅ | ✅ | ✅ |
| 查看他人数据 | ❌ | ✅ | ✅ | ✅ |
| 编辑他人数据 | ❌ | ❌ | ✅ | ✅ |
| 删除他人数据 | ❌ | ❌ | ✅ | ✅ |
| 导出数据 | ❌ | ❌ | ✅ | ✅ |
| 管理员工 | ❌ | ❌ | ❌ | ✅ |

### 店长设置

- 新用户默认角色为 `employee`
- 店长权限需在**云开发控制台**手动设置
- 操作：数据库 → users 集合 → 修改 role 为 `owner`

## 审核流程

1. 录入员创建记录 → 状态为 `pending`（待审核）
2. 审核员/管理员/店长可查看待审核记录
3. 审核通过 → 状态变为 `approved`，所有人均可见
4. 审核驳回 → 状态变为 `rejected`

## 数据库集合

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 用户openId |
| nickName | string | 昵称 |
| avatarUrl | string | 头像URL |
| role | string | 角色 |
| status | string | enabled/disabled |
| phone | string | 手机号 |
| createTime | number | 创建时间 |

### transactions

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 记录ID |
| type | string | income/expense |
| category | string | 分类 |
| amount | number | 金额（分） |
| date | string | 日期 YYYY-MM-DD |
| remark | string | 备注 |
| supplier | string | 供应商 |
| status | string | pending/approved/rejected |
| creatorOpenId | string | 创建人openId |
| creator | string | 创建人昵称 |
| createTime | number | 创建时间 |

### settings

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 用户openId |
| dailyReminderEnabled | boolean | 日结提醒开关 |
| reminderTime | string | 提醒时间 |
| templateId | string | 订阅消息模板ID |
| expenseThreshold | number | 大额支出阈值 |
| lossThreshold | number | 亏损预警阈值 |

## 云函数

### login

- 登录/创建用户
- 绑定手机号

### getTransactions

- `list` - 获取记录列表
- `create` - 创建记录
- `update` - 更新记录
- `delete` - 删除记录
- `approve` - 审核通过
- `reject` - 审核驳回
- `stats` - 统计数据

### manageUsers

- `list` - 用户列表
- `updateRole` - 修改角色
- `toggleStatus` - 启用/禁用
- `resetEmployeeData` - 重置员工数据
- `remove` - 删除用户
- `transferOwner` - 转让店长

## Git 分支策略

```
main  ───  生产环境稳定版本
  ↑
dev  ───  开发分支，日常开发合并到此
  ↑
feature/*  ───  功能分支（按需创建）
```

### 工作流程

1. 开发新功能 → 在 dev 分支
2. 功能完成 → 合并到 dev → 推送
3. 发布前 → dev 合并到 main
4. 上传小程序 → 提交审核 → 发布

## 发布流程

```
1. 确保云函数已上传部署
2. 切换到 dev 分支开发
3. 测试通过后合并到 main
4. 微信开发者工具 → 上传
5. 微信公众平台 → 版本管理 → 提交审核
6. 审核通过 → 发布
```

## 环境

| 环境 | 名称 | 用途 |
|------|------|------|
| cloud1-d6gqwroxrc08ea02c | 生产环境 | 正式使用 |

## 注意事项

- 云函数更新后**立即生效**，不经过审核
- 小程序前端需审核发布后才更新
- 发布前确保云函数代码稳定
- 个人主体无法使用 `getPhoneNumber` 获取手机号

## 相关文档

- [SECURITY_REVIEW_2026-08-16.md](./SECURITY_REVIEW_2026-08-16.md) - 安全审计
- [CHANGELOG.md](./CHANGELOG.md) - 更新日志
