// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const Course = require('./models/Course');
const Student = require('./models/Student');

const app = express();
const PORT = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/university_db');
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

// Session middleware configuration
app.use(session({
  secret: 'some_secret_key', // Replace with a secure key in production
  resave: false,
  saveUninitialized: true
}));

// Middleware to parse JSON and urlencoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (css, js, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// --- Authentication Middleware ---
function isAuthenticated(req, res, next) {
  if (req.session && req.session.student) {
    return next();
  } else {
    res.redirect('/');
  }
}

// --- Routes ---

// Login Page (when visiting localhost, show login page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Process Login
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

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Scheduling Page (protected)
app.get('/schedule', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

// --- Protected API Endpoints ---

// GET all courses
app.get('/api/courses', isAuthenticated, async (req, res) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (err) {
    res.status(500).send(err);
  }
});

// POST a new course
app.post('/api/courses', isAuthenticated, async (req, res) => {
  try {
    const { courseName, day, startTime, endTime } = req.body;
    const newCourse = new Course({ courseName, day, startTime, endTime });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).send(err);
  }
});

// DELETE a course by id
app.delete('/api/courses/:id', isAuthenticated, async (req, res) => {
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
