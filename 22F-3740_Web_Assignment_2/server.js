// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const http = require('http');

const Course = require('./models/Course');
const Student = require('./models/Student');
const Admin = require('./models/Admin');

const app = express();
const server = http.createServer(app);
// If you are using Socket.IO, you can uncomment the following lines:
// const { Server } = require('socket.io');
// const io = new Server(server);

const PORT = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/university_db');
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

// Session middleware configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'x7k9p!mQzL$2vN8rT5jY&wB3qF',
  resave: false,
  saveUninitialized: true
}));

// Serve static files (css, js, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Middlewares ---
function isStudentAuthenticated(req, res, next) {
  if (req.session && req.session.student) return next();
  res.redirect('/');
}

function isAdminAuthenticated(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// Helper: Convert time string "HH:MM" to minutes
function convertTimeToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

// =====================
// LANDING & STUDENT ROUTES
// =====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.post('/login', async (req, res) => {
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
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/schedule', isStudentAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

// =====================
// STUDENT API ENDPOINTS
// =====================
app.get('/api/courses', isStudentAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/courses', isStudentAuthenticated, async (req, res) => {
  try {
    const { courseName, day, startTime, endTime } = req.body;
    const newCourse = new Course({ courseName, day, startTime, endTime });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.delete('/api/courses/:id', isStudentAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Register a course
app.post('/api/register-course', isStudentAuthenticated, async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const student = await Student.findById(req.session.student._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    if (student.registeredCourses.includes(courseId)) {
      // Already registered; do not decrement seat count again.
      return res.status(200).json({ message: 'Course already registered', course });
    }
    if (course.seatCount <= 0) {
      return res.status(400).json({ message: 'No seats available' });
    }
    course.seatCount -= 1;
    await course.save();

    student.registeredCourses.push(courseId);
    await student.save();
    res.status(200).json({ message: 'Course registered successfully', course });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get student's registered courses
app.get('/api/student/courses', isStudentAuthenticated, async (req, res) => {
  try {
    const student = await Student.findById(req.session.student._id).populate('registeredCourses');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.status(200).json(student.registeredCourses);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get distinct departments
app.get('/api/departments', isStudentAuthenticated, async (req, res) => {
  try {
    const departments = await Course.distinct('department', { department: { $ne: '' } });
    res.json(departments);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Unregister a course – now also clear timetable details so that the slot is freed up
app.delete('/api/unregister-course', isStudentAuthenticated, async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // Increment seat count and clear timetable details
    course.seatCount += 1;
    course.startTime = "";
    course.endTime = "";
    course.day = "";
    await course.save();

    const student = await Student.findById(req.session.student._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    student.registeredCourses = student.registeredCourses.filter(id => id.toString() !== courseId);
    await student.save();
    res.status(200).json({ message: 'Course unregistered successfully; timetable cleared for this course', course });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Update timetable (with conflict checking)
app.post('/api/student/update-timetable', isStudentAuthenticated, async (req, res) => {
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
});

// =====================
// ADMIN ENDPOINTS FOR STUDENT MANAGEMENT & PREREQUISITES
// =====================

// Get student courses by roll number (for Student Management page)
app.get('/api/admin/student-courses', isAdminAuthenticated, async (req, res) => {
  try {
    const { rollNumber } = req.query;
    if (!rollNumber) return res.status(400).json({ message: 'Roll number is required' });
    const student = await Student.findOne({ rollNumber }).populate('registeredCourses');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.status(200).json({ studentId: student._id, rollNumber: student.rollNumber, courses: student.registeredCourses });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Drop a student from a course (admin action)
app.delete('/api/admin/student-course', isAdminAuthenticated, async (req, res) => {
  try {
    const { studentId, courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    course.seatCount += 1;
    // Optionally clear timetable details for this course if needed
    course.startTime = "";
    course.endTime = "";
    course.day = "";
    await course.save();

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    student.registeredCourses = student.registeredCourses.filter(id => id.toString() !== courseId);
    if (student.prerequisitesStatus) {
      student.prerequisitesStatus = student.prerequisitesStatus.filter(ps => ps.courseId.toString() !== courseId);
    }
    await student.save();
    res.status(200).json({ message: 'Student dropped from course successfully' });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Mark prerequisites pass/fail for a student
app.post('/api/admin/student-course/prerequisites', isAdminAuthenticated, async (req, res) => {
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
});

// Report: Students who have not completed prerequisites
app.get('/api/admin/reports/prerequisites-not-completed', isAdminAuthenticated, async (req, res) => {
  try {
    const students = await Student.find({});
    const result = [];
    students.forEach(student => {
      if (student.prerequisitesStatus && student.prerequisitesStatus.length > 0) {
        const notPassed = student.prerequisitesStatus.filter(ps => ps.status !== 'pass');
        if (notPassed.length > 0) {
          result.push({ studentId: student._id, rollNumber: student.rollNumber, notPassed });
        }
      }
    });
    res.status(200).json({ students: result });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Report: Students for a specific course (by course name)
app.get('/api/admin/reports/course-students', isAdminAuthenticated, async (req, res) => {
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
        result.push({ studentId: student._id, rollNumber: student.rollNumber });
      }
    });
    res.json({ students: result });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Report: Courses with available seats
app.get('/api/admin/reports/available-courses', isAdminAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({ seatCount: { $gt: 0 } });
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
});

// =====================
// ADMIN ROUTES (Login/Logout/Dashboard)
// =====================
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.post('/admin/login', async (req, res) => {
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
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Admin logout error:', err);
      return res.status(500).send('Error during logout');
    }
    res.redirect('/');
  });
});

app.get('/admin/dashboard', isAdminAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// =====================
// ADMIN API ENDPOINTS (Course Management)
// =====================
app.get('/api/admin/courses', isAdminAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({}).populate('prerequisites');
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/admin/courses', isAdminAuthenticated, async (req, res) => {
  try {
    const { courseName, prerequisites, seatCount, department } = req.body;
    if (!courseName) return res.status(400).json({ message: 'courseName is required' });
    const existingCourse = await Course.findOne({ courseName: new RegExp(`^${courseName.trim()}$`, 'i') });
    if (existingCourse) {
      return res.status(400).json({ message: 'Course with the same name already exists' });
    }
    const newCourse = new Course({
      courseName,
      prerequisites: prerequisites || [],
      seatCount: seatCount || 0,
      department: department || ''
    });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.put('/api/admin/courses/:id', isAdminAuthenticated, async (req, res) => {
  try {
    const updatedCourse = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.delete('/api/admin/courses/:id', isAdminAuthenticated, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
});

// =====================
// START SERVER
// =====================
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
