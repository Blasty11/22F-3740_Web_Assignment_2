const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  courseName: String,
  day: String,
  startTime: String,
  endTime: String,
  seatCount: Number,
  prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  department: String
});

module.exports = mongoose.model('Course', CourseSchema);
