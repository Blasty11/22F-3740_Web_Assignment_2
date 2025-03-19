// models/Admin.js
const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true } // For demo purposes, stored as plain text
});

module.exports = mongoose.model('Admin', AdminSchema);
