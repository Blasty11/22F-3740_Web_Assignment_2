const mongoose = require('mongoose');
const { Schema } = mongoose;

const courseSchema = new Schema({
  courseCode: { type: String },
  courseName: { type: String, required: true },
  seatCount: { type: Number, default: 0 },
  department: { type: String, default: '' },
  prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  day: { type: String, default: '' },
  subscribers: [{ type: Schema.Types.ObjectId, ref: 'Student' }]
});

module.exports = mongoose.model('Course', courseSchema);
