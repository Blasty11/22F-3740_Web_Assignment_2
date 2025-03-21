const path = require('path');
const Course = require('../models/Course');
const Student = require('../models/Student');

function convertTimeToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

exports.postLogin = async (req, res) => {
  const { rollNumber } = req.body;
  if (!rollNumber) return res.status(400).json({ message: 'Roll number is required' });
  try {
    const student = await Student.findOne({ rollNumber });
    if (student) {
      req.session.student = student;
      return res.status(200).json({ message: 'Login successful' });
    }
    return res.status(401).json({ message: 'Roll number not found' });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.session.student._id).select('username rollNumber');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getLogout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

exports.getSchedulePage = (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'schedule.html'));
};

exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.postRegisterCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (course.prerequisites && course.prerequisites.length > 0) {
      return res.status(400).json({ message: 'This course has prerequisites. Please complete them before registering.' });
    }

    const student = await Student.findById(req.session.student._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    if (student.registeredCourses.includes(courseId)) {
      return res.status(200).json({ message: 'Course already registered', course });
    }
    if (course.seatCount <= 0) {
      return res.status(400).json({ message: 'No seats available. Consider subscribing for notifications.' });
    }
    course.seatCount -= 1;
    await course.save();

    student.registeredCourses.push(courseId);
    await student.save();
    res.status(200).json({ message: 'Course registered successfully', course });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.postCreateCourse = async (req, res) => {
  try {
    const { courseName, day, startTime, endTime } = req.body;
    const newCourse = new Course({ courseName, day, startTime, endTime });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getStudentCourses = async (req, res) => {
  try {
    const student = await Student.findById(req.session.student._id).populate('registeredCourses');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.status(200).json(student.registeredCourses);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const departments = await Course.distinct('department', { department: { $ne: '' } });
    res.json(departments);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.deleteUnregisterCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    course.seatCount += 1;
    course.startTime = "";
    course.endTime = "";
    course.day = "";
    await course.save();

    const student = await Student.findById(req.session.student._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    student.registeredCourses = student.registeredCourses.filter(id => id.toString() !== courseId);
    await student.save();

    if (course.seatCount > 0 && course.subscribers && course.subscribers.length > 0) {
      console.log(`Notifying ${course.subscribers.length} subscriber(s) that a seat is now available for ${course.courseName}.`);
      course.subscribers = [];
      await course.save();
    }

    res.status(200).json({
      message: 'Course unregistered successfully; timetable cleared for this course',
      course
    });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.postUpdateTimetable = async (req, res) => {
  try {
    const { courseId, startTime, endTime, day } = req.body;
    if (!courseId || !startTime || !endTime || !day) {
      return res.status(400).json({ message: 'courseId, startTime, endTime, and day are required' });
    }
    const student = await Student.findById(req.session.student._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.registeredCourses.map(id => id.toString()).includes(courseId)) {
      return res.status(400).json({ message: 'Course not registered. Please register first.' });
    }
    const registeredCourses = await Course.find({ _id: { $in: student.registeredCourses } });
    const otherCourses = registeredCourses.filter(c => c._id.toString() !== courseId);
    const updatedStart = convertTimeToMinutes(startTime);
    const updatedEnd = convertTimeToMinutes(endTime);

    for (const c of otherCourses) {
      if (c.day === day) {
        const cStart = convertTimeToMinutes(c.startTime);
        const cEnd = convertTimeToMinutes(c.endTime);
        if (updatedStart < cEnd && cStart < updatedEnd) {
          return res.status(400).json({ message: 'Conflict detected with another course. Timetable not updated.' });
        }
      }
    }

    const courseToUpdate = await Course.findById(courseId);
    if (!courseToUpdate) return res.status(404).json({ message: 'Course not found' });

    courseToUpdate.startTime = startTime;
    courseToUpdate.endTime = endTime;
    courseToUpdate.day = day;
    await courseToUpdate.save();
    res.status(200).json({ message: 'Course updated successfully', course: courseToUpdate });
  } catch (err) {
    console.error('Error in update-timetable:', err);
    res.status(500).send(err);
  }
};

exports.postSubscribeCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ message: 'Course ID is required' });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const studentId = req.session.student._id;
    if (!course.subscribers) {
      course.subscribers = [];
    }
    if (course.subscribers.includes(studentId)) {
      return res.status(400).json({ message: 'Already subscribed for notifications' });
    }
    course.subscribers.push(studentId);
    await course.save();
    res.status(200).json({ message: 'Subscribed successfully for seat availability notifications' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error subscribing to course notifications' });
  }
};

exports.getAllCoursesForPrereq = async (req, res) => {
  try {
    const courses = await Course.find({}).select('courseName courseCode');
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getCoursePrerequisiteChain = async (req, res) => {
  const { courseId } = req.query;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });

  async function getPrereqChain(id, visited = new Set()) {
    if (visited.has(id)) return [];
    visited.add(id);
    const course = await Course.findById(id).populate('prerequisites', 'courseName courseCode');
    if (!course || !course.prerequisites || course.prerequisites.length === 0) return [];
    let chain = [];
    for (let prereq of course.prerequisites) {
      chain.push(prereq);
      const subChain = await getPrereqChain(prereq._id, visited);
      chain = chain.concat(subChain);
    }
    return chain;
  }

  try {
    const chain = await getPrereqChain(courseId);
    res.json({ chain });
  } catch (err) {
    res.status(500).send(err);
  }
};
