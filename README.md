# 跳跳经营记账小程序

微信小程序云开发版，用于日常收支记账管理。

## 项目结构

```
drinkexpensetracker-miniapp/
├── app.js                      # 应用入口，云开发初始化
├── app.json                    # 应用配置（已配置 lazyCodeLoading）
├── project.config.json         # 微信开发者工具配置
├── project.private.config.json # 私有配置（云环境 ID）
├── sitemap.json                # SEO 配置
├── README.md                   # 项目文档
├── CHANGELOG.md                # 修改日志
├── REVIEW.md                   # 代码审查报告
├── utils/
│   ├── config.js               # 配置管理（云环境、模板 ID、分类）
│   ├── format.js               # 格式化工具（颜色、图表）
│   ├── category.js             # 分类管理
│   ├── excel.js                # Excel 生成工具
│   └── common.js               # 公共工具函数
├── pages/
│   ├── index/                  # 首页
│   │   ├── index.js            # 首页逻辑
│   │   ├── index.wxml          # 首页模板
│   │   ├── index.wxss          # 首页样式
│   │   └── index.json          # 页面配置
│   ├── expense/                # 支出明细
│   │   ├── expense.js
│   │   ├── expense.wxml
│   │   ├── expense.wxss
│   │   └── expense.json
│   └── income/                 # 收入明细
│       ├── income.js
│       ├── income.wxml
│       ├── income.wxss
│       └── income.json
└── cloudfunctions/
    ├── login/                  # 用户登录/注册
    ├── getTransactions/        # 数据操作（CRUD）
    ├── manageUsers/            # 员工管理
    ├── sendReminder/           # 提醒功能
    ├── exportExcel/            # Excel 导出
    └── migrateRecords/         # 数据迁移
```

## 功能列表

- [x] 快速记账（收入/支出）
- [x] 今日/本月统计数据
- [x] 数据分析（趋势图、饼图）
- [x] 数据导出（Excel）
- [x] 自定义筛选导出
- [x] 微信登录（自动注册为员工）
- [x] 员工管理（角色修改、禁用/启用、重置数据、删除）
- [x] 智能提醒设置
- [x] 微信分享（朋友/朋友圈）
- [x] 访客模式（本地存储，云端同步）
- [x] 修改个人信息（头像、昵称）
- [x] 按需组件注入优化

## 快速开始

### 1. 环境准备

- 微信开发者工具
- 微信小程序 AppID
- 开通云开发服务

### 2. 云开发配置

1. 打开微信开发者工具，创建新项目
2. 开通云开发，创建环境（环境ID：`cloud1-d6gqwroxrc08ea02c`）
3. 创建数据库集合：
   - `transactions` - 交易记录
   - `users` - 用户信息
   - `settings` - 用户设置

### 3. 数据库权限设置

**重要**：请在微信云开发控制台设置以下集合权限：

| 集合 | 读取权限 | 写入权限 |
|------|----------|----------|
| transactions | 仅创建者可读 | 仅创建者可写 |
| users | 所有用户可读 | 仅创建者可写 |
| settings | 仅创建者可读 | 仅创建者可写 |

设置路径：微信开发者工具 → 云开发控制台 → 数据库 → 选择集合 → 权限设置

### 4. 上传云函数

在微信开发者工具中，右键以下文件夹 → 上传并部署：云端安装依赖

- `cloudfunctions/getTransactions`
- `cloudfunctions/login`
- `cloudfunctions/manageUsers`
- `cloudfunctions/sendReminder`
- `cloudfunctions/exportExcel`
- `cloudfunctions/migrateRecords`

### 5. 配置订阅消息模板

1. 在微信公众平台「功能」→「订阅消息」中添加模板
2. 复制模板 ID
3. 在小程序「设置」页面填写模板 ID 并保存

## 使用说明

### 登录与权限

| 角色 | 说明 | 权限 |
|------|------|------|
| 店长 | 第一个登录的用户或手动设置 | 全部权限 |
| 管理员 | 可查看编辑删除所有数据 | 店长手动设置 |
| 审核员 | 可查看所有数据，审核录入员数据 | 店长手动设置 |
| 录入员 | 默认角色，只能操作自己的数据 | 自动分配 |

### 店长操作

1. **管理员工**：点击顶部「员工」按钮
   - 修改员工角色
   - 禁用/启用员工（禁用后无法登录）
   - 重置员工数据
   - 删除员工

2. **导出数据**：点击右上角「导出」按钮

3. **数据迁移**：设置页面点击「数据迁移」（首次使用）

### 记账

1. 点击"记收入"或"记支出"按钮
2. 选择分类、输入金额、日期、供应商、备注
3. 点击确定保存

### 数据分析

1. 切换到"数据"Tab
2. 查看月度收支趋势图、分类占比饼图

### 智能提醒

1. 登录后点击"设置"
2. 开启日结提醒、设置提醒时间
3. 配置大额支出预警、亏损预警阈值

## 数据库结构

### users 集合
```javascript
{
  _id: openId,           // 用户唯一标识
  nickName: string,      // 昵称
  avatarUrl: string,     // 头像 URL
  role: string,          // owner | admin | reviewer | employee
  status: string,        // enabled | disabled
  createTime: number     // 创建时间戳
}
```

### transactions 集合
```javascript
{
  _id: string,           // 记录 ID
  type: string,          // income | expense
  category: string,      // 分类
  amount: number,        // 金额（分）
  date: string,          // 日期 YYYY-MM-DD
  supplier: string,      // 供应商
  remark: string,        // 备注
  createTime: number,    // 创建时间
  creatorOpenId: string, // 创建者 openId
  creator: string,       // 创建者昵称（兼容旧数据）
  creatorAvatar: string, // 创建者头像
  status: string         // approved | pending（审核状态）
}
```

### settings 集合
```javascript
{
  _id: openId,           // 用户 openId
  dailyReminderEnabled: boolean,
  reminderTime: string,  // HH:mm
  templateId: string,    // 订阅消息模板 ID
  expenseThreshold: number,  // 大额支出阈值（分）
  lossThreshold: number      // 亏损预警阈值（分）
}
```

## 技术栈

- 微信小程序原生开发
- 微信云开发（云函数、云数据库、云存储）
- Canvas 绑定图表

## 相关文档

- [CHANGELOG.md](CHANGELOG.md) - 修改日志
- [REVIEW.md](REVIEW.md) - 代码审查报告

## License

MIT
