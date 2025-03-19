// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const Course = require('./models/Course');
const Student = require('./models/Student');
const Admin = require('./models/Admin');

const app = express();
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

// --- Student Routes ---
// Student Login Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
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

// Student Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Student Scheduling Page (protected)
app.get('/schedule', isStudentAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

// --- Student API Endpoints ---
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
    // Students add courses without prerequisites/seatCount info
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

// --- Admin Routes ---
// Admin Login Page
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// Process Admin Login
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

// Admin Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Admin Dashboard (protected)
app.get('/admin/dashboard', isAdminAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// --- Admin API Endpoints ---
// Get all courses (for management)
app.get('/api/admin/courses', isAdminAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({}).populate('prerequisites');
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Add a new course (with prerequisites and seat count)
app.post('/api/admin/courses', isAdminAuthenticated, async (req, res) => {
  try {
    const { courseName, day, startTime, endTime, prerequisites, seatCount } = req.body;
    const newCourse = new Course({
      courseName,
      day,
      startTime,
      endTime,
      prerequisites: prerequisites || [],
      seatCount: seatCount || 0
    });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Update an existing course (including prerequisites and seat management)
app.put('/api/admin/courses/:id', isAdminAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // Expect keys: courseName, day, startTime, endTime, prerequisites, seatCount
    const updatedCourse = await Course.findByIdAndUpdate(id, updateData, { new: true });
    res.json(updatedCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Delete a course
app.delete('/api/admin/courses/:id', isAdminAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    res.status(200).json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
