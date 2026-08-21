// cloudfunctions/exportExcel/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-d6gqwroxrc08ea02c' })

const db = cloud.database()
const transactionsCollection = db.collection('transactions')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID || wxContext.openId

  // 验证用户身份
  if (!openId) {
    return { success: false, error: '无法获取用户身份' }
  }

  const { startDate, endDate, type, categories } = event

  try {
    // 获取用户信息验证是否为店长
    const userRes = await db.collection('users').where({ _id: openId }).get()
    const isOwner = userRes.data && userRes.data.length > 0 && userRes.data[0].role === 'owner'

    if (!isOwner) {
      return { success: false, error: '只有店长可以导出数据' }
    }

    // 构建查询条件
    let query = {}

    // 日期范围
    if (startDate && endDate) {
      query.date = db.command.and(
        db.command.gte(startDate),
        db.command.lte(endDate)
      )
    }

    // 获取数据
    let res = await transactionsCollection.where(query).orderBy('date', 'desc').limit(1000).get()

    let data = res.data

    // 筛选类型
    if (type && type !== 'all') {
      data = data.filter(item => item.type === type)
    }

    // 筛选分类
    if (categories && categories.length > 0 && categories.length < 20) {
      data = data.filter(item => categories.includes(item.category))
    }

    if (data.length === 0) {
      return { success: false, error: '暂无数据' }
    }

    // 生成 Excel 内容（HTML 格式，Excel 可直接打开）
    let excelContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="记账明细">
<Table>
<Column ss:Width="100"/>
<Column ss:Width="80"/>
<Column ss:Width="100"/>
<Column ss:Width="100"/>
<Column ss:Width="100"/>
<Column ss:Width="200"/>
<Row>
<Cell><Data ss:Type="String">日期</Data></Cell>
<Cell><Data ss:Type="String">类型</Data></Cell>
<Cell><Data ss:Type="String">分类</Data></Cell>
<Cell><Data ss:Type="String">供应商</Data></Cell>
<Cell><Data ss:Type="String">金额（元）</Data></Cell>
<Cell><Data ss:Type="String">备注</Data></Cell>
</Row>`

    // 转义函数
    const escapeXml = (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
    };

    // 添加数据行
    data.forEach(item => {
      const typeText = item.type === 'income' ? '收入' : '支出'
      const amount = (item.amount / 100).toFixed(2)
      const remark = escapeXml(item.remark)
      const supplier = escapeXml(item.supplier)

      excelContent += `
<Row>
<Cell><Data ss:Type="String">${escapeXml(item.date)}</Data></Cell>
<Cell><Data ss:Type="String">${escapeXml(typeText)}</Data></Cell>
<Cell><Data ss:Type="String">${escapeXml(item.category)}</Data></Cell>
<Cell><Data ss:Type="String">${supplier}</Data></Cell>
<Cell><Data ss:Type="Number">${amount}</Data></Cell>
<Cell><Data ss:Type="String">${remark}</Data></Cell>
</Row>`
    })

    // 添加汇总行
    let totalIncome = 0, totalExpense = 0
    data.forEach(item => {
      if (item.type === 'income') totalIncome += item.amount
      else totalExpense += item.amount
    })

    const profit = totalIncome - totalExpense

    excelContent += `
<Row>
<Cell><Data ss:Type="String">合计</Data></Cell>
<Cell><Data ss:Type="String">收入</Data></Cell>
<Cell></Cell>
<Cell></Cell>
<Cell><Data ss:Type="Number">${(totalIncome / 100).toFixed(2)}</Data></Cell>
<Cell></Cell>
</Row>
<Row>
<Cell><Data ss:Type="String">合计</Data></Cell>
<Cell><Data ss:Type="String">支出</Data></Cell>
<Cell></Cell>
<Cell></Cell>
<Cell><Data ss:Type="Number">${(totalExpense / 100).toFixed(2)}</Data></Cell>
<Cell></Cell>
</Row>
<Row>
<Cell><Data ss:Type="String">合计</Data></Cell>
<Cell><Data ss:Type="String">利润</Data></Cell>
<Cell></Cell>
<Cell></Cell>
<Cell><Data ss:Type="Number">${((profit) / 100).toFixed(2)}</Data></Cell>
<Cell></Cell>
</Row>`

    // 添加分类统计Sheet
    const categoryStats = {}
    data.forEach(item => {
      const key = item.category
      if (!categoryStats[key]) {
        categoryStats[key] = { income: 0, expense: 0 }
      }
      if (item.type === 'income') {
        categoryStats[key].income += item.amount
      } else {
        categoryStats[key].expense += item.amount
      }
    })

    excelContent += `
</Table>
</Worksheet>
<Worksheet ss:Name="分类统计">
<Table>
<Column ss:Width="120"/>
<Column ss:Width="100"/>
<Column ss:Width="100"/>
<Column ss:Width="100"/>
<Row>
<Cell><Data ss:Type="String">分类</Data></Cell>
<Cell><Data ss:Type="String">类型</Data></Cell>
<Cell><Data ss:Type="String">金额（元）</Data></Cell>
<Cell><Data ss:Type="String">占比</Data></Cell>
</Row>`

    const total = totalIncome + totalExpense
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const amount = stats.income + stats.expense
      const percent = total > 0 ? ((amount / total) * 100).toFixed(1) + '%' : '0%'

      if (stats.income > 0) {
        excelContent += `
<Row>
<Cell><Data ss:Type="String">${category}</Data></Cell>
<Cell><Data ss:Type="String">收入</Data></Cell>
<Cell><Data ss:Type="Number">${(stats.income / 100).toFixed(2)}</Data></Cell>
<Cell><Data ss:Type="String">${percent}</Data></Cell>
</Row>`
      }
      if (stats.expense > 0) {
        excelContent += `
<Row>
<Cell><Data ss:Type="String">${category}</Data></Cell>
<Cell><Data ss:Type="String">支出</Data></Cell>
<Cell><Data ss:Type="Number">${(stats.expense / 100).toFixed(2)}</Data></Cell>
<Cell><Data ss:Type="String">${percent}</Data></Cell>
</Row>`
      }
    })

    excelContent += `
</Table>
</Worksheet>
</Workbook>`

    // 将内容上传到云存储
    const fileName = `export_${Date.now()}.xls`
    const uploadRes = await cloud.uploadFile({
      cloudPath: 'exports/' + fileName,
      fileContent: Buffer.from(excelContent, 'utf-8')
    })

    return {
      success: true,
      fileID: uploadRes.fileID
    }

  } catch (err) {
    return { success: false, error: err.message }
  }
}
