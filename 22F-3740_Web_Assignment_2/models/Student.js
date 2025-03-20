const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  registeredCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

module.exports = mongoose.model('Student', StudentSchema);
