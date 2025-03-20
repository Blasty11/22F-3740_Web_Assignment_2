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
// If you are using Socket.IO, keep the following lines:
// const { Server } = require('socket.io');
// const io = new Server(server);

const PORT = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/university_db');
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

// Session middleware configuration
app.use(session({
  secret: 'x7k9p!mQzL$2vN8rT5jY&wB3qF', // Use a secure key in production
  resave: false,
  saveUninitialized: true
}));

// Middleware to parse JSON and urlencoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (css, js, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Middlewares ---
function isStudentAuthenticated(req, res, next) {
  if (req.session && req.session.student) {
    return next();
  } else {
    res.redirect('/');
  }
}

function isAdminAuthenticated(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  } else {
    res.redirect('/admin/login');
  }
}

// --- Landing & Student Routes ---
// GET "/" - Serve landing page with two buttons
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Process Student Login
app.post('/login', async (req, res) => {
  const { rollNumber } = req.body;
  if (!rollNumber) {
    return res.status(400).json({ message: 'Roll number is required' });
  }
  try {
    const student = await Student.findOne({ rollNumber });
    if (student) {
      req.session.student = student;
      res.status(200).json({ message: 'Login successful' });
    } else {
      res.status(401).json({ message: 'Roll number not found' });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

// Student Logout (with proper callback)
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error during logout');
    }
    res.redirect('/');
  });
});

// Student Scheduling Page (protected)
app.get('/schedule', isStudentAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

// --- Student API Endpoints ---

// 1) Get all courses
app.get('/api/courses', isStudentAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
});

// 2) Create a new course (optional for students)
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

// 3) Delete a course (optional for students)
app.delete('/api/courses/:id', isStudentAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    // If using Socket.IO, you can emit an event here
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
});

// 4) Register a course (decrement seatCount, add to student's registeredCourses)
app.post('/api/register-course', isStudentAuthenticated, async (req, res) => {
  try {
    const { courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.seatCount <= 0) {
      return res.status(400).json({ message: 'No seats available' });
    }

    // Decrement seat count
    course.seatCount -= 1;
    await course.save();

    // Update student's registeredCourses
    const studentId = req.session.student._id;
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    if (student.registeredCourses.includes(courseId)) {
      return res.status(400).json({ message: 'Course already registered' });
    }
    student.registeredCourses.push(courseId);
    await student.save();

    // If using Socket.IO, emit a seat-update event here
    res.status(200).json({ message: 'Course registered successfully', course });
  } catch (err) {
    res.status(500).send(err);
  }
});

// 5) Retrieve the logged-in student's registered courses
app.get('/api/student/courses', isStudentAuthenticated, async (req, res) => {
  try {
    const studentId = req.session.student._id;
    const student = await Student.findById(studentId).populate('registeredCourses');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.status(200).json(student.registeredCourses);
  } catch (err) {
    res.status(500).send(err);
  }
});

// 6) NEW: Return distinct departments for dynamic dropdown
app.get('/api/departments', isStudentAuthenticated, async (req, res) => {
  try {
    // Fetch all distinct departments, ignoring null or empty
    const departments = await Course.distinct('department', { department: { $ne: '' } });
    res.json(departments);
  } catch (err) {
    res.status(500).send(err);
  }
});

// --- Admin Routes ---
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const admin = await Admin.findOne({ username, password });
    if (admin) {
      req.session.admin = admin;
      res.status(200).json({ message: 'Admin login successful' });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
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

// --- Admin API Endpoints ---
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
    const { courseName, day, startTime, endTime, prerequisites, seatCount, department } = req.body;
    const newCourse = new Course({
      courseName,
      day,
      startTime,
      endTime,
      prerequisites: prerequisites || [],
      seatCount: seatCount || 0,
      department: department || ''
    });
    await newCourse.save();
    // If using Socket.IO, emit an event
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.put('/api/admin/courses/:id', isAdminAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const updatedCourse = await Course.findByIdAndUpdate(id, updateData, { new: true });
    // If using Socket.IO, emit an event
    res.json(updatedCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.delete('/api/admin/courses/:id', isAdminAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    // If using Socket.IO, emit an event
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
