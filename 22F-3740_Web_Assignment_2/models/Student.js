const mongoose = require('mongoose');
const { Schema } = mongoose;

const prerequisiteStatusSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  status: { type: String, default: 'fail' }
});

const studentSchema = new Schema({
  username: { type: String },
  rollNumber: { type: String, required: true, unique: true },
  registeredCourses: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
  prerequisitesStatus: [prerequisiteStatusSchema]
});

module.exports = mongoose.model('Student', studentSchema);
