// models/Course.js
const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  day: { type: String, required: true },       // e.g., "Monday"
  startTime: { type: String, required: true },   // format "HH:MM"
  endTime: { type: String, required: true }      // format "HH:MM"
});

module.exports = mongoose.model('Course', CourseSchema);
