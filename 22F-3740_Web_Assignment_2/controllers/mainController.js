const path = require('path');

exports.getLandingPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'landing.html'));
};

exports.getAdminLoginPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'admin', 'login.html'));
};

exports.getAdminDashboardPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'admin', 'dashboard.html'));
};
