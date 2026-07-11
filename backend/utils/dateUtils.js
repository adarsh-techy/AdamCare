// Returns the server's current local calendar date as 'YYYY-MM-DD'.
// Deliberately avoids Date#toISOString(), which converts to UTC and can
// report the wrong calendar day whenever the local timezone is ahead of UTC.
const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

module.exports = { getTodayDateStr };
