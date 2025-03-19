// models/Course.js
const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  day: { type: String, required: true },       // e.g., "Monday"
  startTime: { type: String, required: true },   // format "HH:MM"
  endTime: { type: String, required: true },     // format "HH:MM"
  prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  seatCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Course', CourseSchema);
