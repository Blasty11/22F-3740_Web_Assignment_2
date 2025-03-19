// models/Student.js
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Student', StudentSchema);
