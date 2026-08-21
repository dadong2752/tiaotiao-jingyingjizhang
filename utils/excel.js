// utils/excel.js

/**
 * XML 转义函数
 * @param {string} s - 待转义字符串
 * @returns {string} 转义后的字符串
 */
function escapeXml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 生成 Excel 内容（XML 格式）
 * @param {Array} data - 记账记录数组
 * @param {Object} options - 配置选项
 * @param {string} options.sheetName - 工作表名称，默认"记账明细"
 * @param {boolean} options.includeSupplier - 是否包含供应商字段，默认 false
 * @returns {string} Excel XML 内容
 */
function generateExcelXML(data, options = {}) {
  const {
    sheetName = '记账明细',
    includeSupplier = false
  } = options;

  // 表头
  let headerCells = `<Cell><Data ss:Type="String">日期</Data></Cell>
<Cell><Data ss:Type="String">类型</Data></Cell>
<Cell><Data ss:Type="String">分类</Data></Cell>`;

  if (includeSupplier) {
    headerCells += `<Cell><Data ss:Type="String">供应商</Data></Cell>`;
  }

  headerCells += `<Cell><Data ss:Type="String">金额（元）</Data></Cell>
<Cell><Data ss:Type="String">备注</Data></Cell>`;

  // 转义工作表名称
  const safeSheetName = escapeXml(sheetName);

  let excel = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${safeSheetName}">
<Table>
<Row>
${headerCells}
</Row>`;

  // 排序数据（按日期倒序）
  const sortedData = [...data].sort((a, b) => b.date.localeCompare(a.date));

  // 添加数据行
  sortedData.forEach(item => {
    const type = item.type === 'income' ? '收入' : '支出';
    const amount = (item.amount / 100).toFixed(2);
    const remark = escapeXml(item.remark);
    const supplier = includeSupplier ? `<Cell><Data ss:Type="String">${escapeXml(item.supplier)}</Data></Cell>` : '';

    excel += `<Row><Cell><Data ss:Type="String">${escapeXml(item.date)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(type)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(item.category)}</Data></Cell>${supplier}<Cell><Data ss:Type="Number">${amount}</Data></Cell><Cell><Data ss:Type="String">${remark}</Data></Cell></Row>`;
  });

  // 添加统计行
  let totalIncome = 0, totalExpense = 0;
  sortedData.forEach(item => {
    if (item.type === 'income') totalIncome += item.amount;
    else totalExpense += item.amount;
  });

  const profit = totalIncome - totalExpense;
  const summarySupplierCell = includeSupplier ? '<Cell></Cell>' : '';

  excel += `<Row><Cell><Data ss:Type="String">合计</Data></Cell><Cell><Data ss:Type="String">收入</Data></Cell><Cell></Cell>${summarySupplierCell}<Cell><Data ss:Type="Number">${(totalIncome / 100).toFixed(2)}</Data></Cell><Cell></Cell></Row>`;
  excel += `<Row><Cell><Data ss:Type="String">合计</Data></Cell><Cell><Data ss:Type="String">支出</Data></Cell><Cell></Cell>${summarySupplierCell}<Cell><Data ss:Type="Number">${(totalExpense / 100).toFixed(2)}</Data></Cell><Cell></Cell></Row>`;
  excel += `<Row><Cell><Data ss:Type="String">合计</Data></Cell><Cell><Data ss:Type="String">利润</Data></Cell><Cell></Cell>${summarySupplierCell}<Cell><Data ss:Type="Number">${((profit) / 100).toFixed(2)}</Data></Cell><Cell></Cell></Row>`;

  excel += '</Table></Worksheet></Workbook>';
  return excel;
}

/**
 * 下载 Excel 文件
 * @param {string} excelContent - Excel XML 内容
 * @param {string} fileName - 文件名（不含扩展名）
 */
function downloadExcel(excelContent, fileName) {
  const fullFileName = `${fileName}.xls`;
  const fs = wx.getFileSystemManager();
  const filePath = wx.env.USER_DATA_PATH + '/' + fullFileName;

  wx.showLoading({ title: '导出中...' });

  fs.writeFile({
    filePath: filePath,
    data: excelContent,
    encoding: 'utf-8',
    success: () => {
      wx.hideLoading();
      wx.openDocument({
        filePath: filePath,
        fileType: 'xls',
        success: () => {
          console.log('导出成功');
        },
        fail: err => {
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      });
    },
    fail: err => {
      wx.hideLoading();
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  });
}

module.exports = {
  generateExcelXML,
  downloadExcel,
  escapeXml
};
