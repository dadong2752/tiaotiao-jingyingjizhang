// utils/common.js
// 公共工具函数

// 获取月份最后一天
function getMonthLastDay(year, month) {
  const date = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 获取今日日期 YYYY-MM-DD
function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 获取月初日期 YYYY-MM-01
function getMonthFirstDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// 生成 UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 格式化日期
function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

module.exports = {
  getMonthLastDay,
  getTodayDate,
  getMonthFirstDay,
  generateUUID,
  formatDate
};
