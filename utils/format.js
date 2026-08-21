// utils/format.js

// 图表颜色配置 - 统一颜色方案
const CHART_COLORS = ['#52C41A', '#FF4D4F', '#1890FF', '#FAAD14', '#722ED1', '#13C2C2', '#EB2F96', '#F5222D'];

/**
 * 格式化金额（分转元）
 * @param {number} cents - 金额（分）
 * @returns {string} 格式化后的金额
 */
function formatMoney(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * 格式化日期
 * @param {Date|string} date - 日期
 * @returns {string} 格式化后的日期 YYYY-MM-DD
 */
function formatDate(date) {
  if (typeof date === 'string') {
    return date;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  formatMoney,
  formatDate,
  CHART_COLORS
};
