const Admin = require('../models/Admin');
const Course = require('../models/Course');
const Student = require('../models/Student');

exports.postAdminLogin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
  try {
    const admin = await Admin.findOne({ username, password });
    if (admin) {
      req.session.admin = admin;
      return res.status(200).json({ message: 'Admin login successful' });
    }
    return res.status(401).json({ message: 'Invalid credentials' });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getAdminLogout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Admin logout error:', err);
      return res.status(500).send('Error during logout');
    }
    res.redirect('/');
  });
};

exports.getStudentCoursesForAdmin = async (req, res) => {
  try {
    const { rollNumber } = req.query;
    if (!rollNumber) return res.status(400).json({ message: 'Roll number is required' });
    const student = await Student.findOne({ rollNumber }).populate('registeredCourses');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const courses = [];
    for (let courseDoc of student.registeredCourses) {
      const enrolled = await Student.countDocuments({ registeredCourses: courseDoc._id });
      const courseObj = courseDoc.toObject();
      courseObj.enrolledCount = enrolled;
      courses.push(courseObj);
    }
    res.status(200).json({ studentId: student._id, rollNumber: student.rollNumber, courses });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.deleteStudentCourseForAdmin = async (req, res) => {
  try {
    const { studentId, courseId } = req.body;
    if (!studentId || !courseId) {
      return res.status(400).json({ message: 'studentId and courseId are required' });
    }

    // 1) Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // 2) Increment seatCount
    course.seatCount += 1;

    // 3) If course now has open seats, clear its schedule fields
    if (course.seatCount > 0) {
      course.startTime = '';
      course.endTime   = '';
      course.day       = '';
    }

    await course.save();

    // 4) Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // 5) Remove the course from their registeredCourses
    student.registeredCourses = student.registeredCourses
      .filter(id => id.toString() !== courseId);

    // 6) Also remove any prereq status entries for that course
    if (Array.isArray(student.prerequisitesStatus)) {
      student.prerequisitesStatus = student.prerequisitesStatus
        .filter(ps => ps.courseId.toString() !== courseId);
    }

    await student.save();

    // 7) Success
    return res
      .status(200)
      .json({ message: 'Student dropped from course successfully' });

  } catch (err) {
    console.error('deleteStudentCourseForAdmin error:', err);
    return res
      .status(500)
      .json({ message: 'Internal server error' });
  }
};

exports.postStudentCoursePrerequisitesForAdmin = async (req, res) => {
  try {
    const { studentId, courseId, status } = req.body;
    if (!studentId || !courseId || !status) {
      return res.status(400).json({ message: 'studentId, courseId, and status are required' });
    }
    if (!['pass', 'fail'].includes(status.toLowerCase())) {
      return res.status(400).json({ message: 'Status must be either "pass" or "fail"' });
    }
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.registeredCourses.map(id => id.toString()).includes(courseId)) {
      return res.status(400).json({ message: 'Course not registered for this student' });
    }
    if (!student.prerequisitesStatus) {
      student.prerequisitesStatus = [];
    }
    const existingEntry = student.prerequisitesStatus.find(ps => ps.courseId.toString() === courseId);
    if (existingEntry) {
      existingEntry.status = status.toLowerCase();
    } else {
      student.prerequisitesStatus.push({ courseId, status: status.toLowerCase() });
    }
    await student.save();
    res.status(200).json({ message: 'Prerequisites status updated successfully' });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getReportPrereqsNotCompleted = async (req, res) => {
  try {
    const students = await Student.find({});
    const result = [];
    students.forEach(student => {
      if (student.prerequisitesStatus && student.prerequisitesStatus.length > 0) {
        const notPassed = student.prerequisitesStatus.filter(ps => ps.status !== 'pass');
        if (notPassed.length > 0) {
          result.push({ rollNumber: student.rollNumber, notPassed });
        }
      }
    });
    res.status(200).json({ students: result });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getReportCourseStudents = async (req, res) => {
  try {
    const { courseName } = req.query;
    if (!courseName) return res.status(400).json({ message: 'courseName is required' });
    const matchedCourses = await Course.find({ courseName: new RegExp(courseName, 'i') });
    if (matchedCourses.length === 0) return res.json({ students: [] });
    const allStudents = await Student.find({}).populate('registeredCourses');
    const result = [];
    allStudents.forEach(student => {
      const matched = student.registeredCourses.some(rc =>
        matchedCourses.some(mc => mc._id.equals(rc._id))
      );
      if (matched) {
        result.push({ username: student.username, rollNumber: student.rollNumber });
      }
    });
    res.json({ students: result });
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getReportAvailableCourses = async (req, res) => {
  try {
    let courses = await Course.find({});
    for (let i = 0; i < courses.length; i++) {
      const enrolled = await Student.countDocuments({ registeredCourses: courses[i]._id });
      courses[i] = courses[i].toObject();
      courses[i].enrolledCount = enrolled;
    }
    courses = courses.filter(c => (c.seatCount - c.enrolledCount) > 0);
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.getAdminCourses = async (req, res) => {
  try {
    let courses = await Course.find({}).populate('prerequisites', 'courseName');
    for (let i = 0; i < courses.length; i++) {
      const enrolled = await Student.countDocuments({ registeredCourses: courses[i]._id });
      courses[i] = courses[i].toObject();
      courses[i].enrolledCount = enrolled;
    }
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.postAdminCourses = async (req, res) => {
  try {
    const { courseCode, courseName, seatCount, department, prerequisites } = req.body;
    if (!courseCode) return res.status(400).json({ message: 'courseCode is required' });
    if (!courseName) return res.status(400).json({ message: 'courseName is required' });

    const prerequisiteIds = [];
    if (prerequisites && prerequisites.length > 0) {
      for (const name of prerequisites) {
        const foundCourse = await Course.findOne({ courseName: name.trim() });
        if (foundCourse) {
          prerequisiteIds.push(foundCourse._id);
        }
      }
    }

    const existingCode = await Course.findOne({ courseCode: new RegExp(`^${courseCode.trim()}$`, 'i') });
    if (existingCode) {
      return res.status(400).json({ message: 'A course with this code already exists.' });
    }

    const newCourse = new Course({
      courseCode,
      courseName,
      seatCount: seatCount || 0,
      department: department || '',
      prerequisites: prerequisiteIds
    });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.putAdminCourses = async (req, res) => {
  try {
    const { courseCode, courseName, seatCount, department, prerequisites } = req.body;
    const prerequisiteIds = [];
    if (prerequisites && prerequisites.length > 0) {
      for (const name of prerequisites) {
        const foundCourse = await Course.findOne({ courseName: name.trim() });
        if (foundCourse) {
          prerequisiteIds.push(foundCourse._id);
        }
      }
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { courseCode, courseName, seatCount, department, prerequisites: prerequisiteIds },
      { new: true }
    );
    res.json(updatedCourse);
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.deleteAdminCourses = async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
};
