// main.js

const calendarBody = document.getElementById('calendar-body');
const form = document.getElementById('course-form');
const conflictWarning = document.getElementById('conflict-warning');

// Define time slots and days
const startHour = 8; // 8 AM
const endHour = 18;  // 6 PM
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Render empty calendar grid
function renderCalendarGrid() {
  calendarBody.innerHTML = '';
  for (let hour = startHour; hour < endHour; hour++) {
    const row = document.createElement('div');
    row.className = 'calendar-row';

    // Time label cell
    const timeCell = document.createElement('div');
    timeCell.className = 'time-cell';
    timeCell.textContent = `${hour}:00`;
    row.appendChild(timeCell);

    // Day cells for each day
    days.forEach(day => {
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';
      dayCell.dataset.day = day;
      dayCell.dataset.hour = hour;
      row.appendChild(dayCell);
    });

    calendarBody.appendChild(row);
  }
}

// Fetch courses from the server
async function fetchCourses() {
  const res = await fetch('/api/courses');
  const courses = await res.json();
  return courses;
}

// Save a new course to the server
async function addCourse(course) {
  const res = await fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course)
  });
  return await res.json();
}

// Delete a course from the server
async function deleteCourse(id) {
  await fetch(`/api/courses/${id}`, { method: 'DELETE' });
}

// Check for scheduling conflicts (for calendar display)
function detectConflicts(courses) {
  const conflicts = new Set();
  days.forEach(day => {
    const dayCourses = courses.filter(course => course.day === day);
    for (let i = 0; i < dayCourses.length; i++) {
      const a = dayCourses[i];
      const aStart = convertTimeToMinutes(a.startTime);
      const aEnd = convertTimeToMinutes(a.endTime);
      for (let j = i + 1; j < dayCourses.length; j++) {
        const b = dayCourses[j];
        const bStart = convertTimeToMinutes(b.startTime);
        const bEnd = convertTimeToMinutes(b.endTime);
        if (aStart < bEnd && bStart < aEnd) {
          conflicts.add(a._id);
          conflicts.add(b._id);
        }
      }
    }
  });
  return conflicts;
}

// Utility: Convert "HH:MM" to minutes since midnight
function convertTimeToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

// Render courses on the calendar
async function renderCourses() {
  renderCalendarGrid();
  const courses = await fetchCourses();
  const conflictIds = detectConflicts(courses);

  courses.forEach(course => {
    const courseStart = convertTimeToMinutes(course.startTime);
    const courseEnd = convertTimeToMinutes(course.endTime);
    const slotDuration = 60;
    const topOffset = ((courseStart - startHour * 60) / slotDuration) * 50;
    const height = ((courseEnd - courseStart) / slotDuration) * 50 - 4;

    const dayCells = document.querySelectorAll(`.day-cell[data-day="${course.day}"]`);
    dayCells.forEach(cell => {
      const cellHour = Number(cell.dataset.hour);
      if (cellHour === Math.floor(courseStart / 60)) {
        const courseDiv = document.createElement('div');
        courseDiv.className = 'course-event';
        courseDiv.textContent = `${course.courseName} (${course.startTime}-${course.endTime})`;
        if (conflictIds.has(course._id)) {
          courseDiv.classList.add('conflict');
        }
        courseDiv.style.top = `${topOffset % 50}px`;
        courseDiv.style.height = `${height}px`;
        courseDiv.addEventListener('click', async () => {
          if (confirm('Delete this course?')) {
            await deleteCourse(course._id);
            renderCourses();
          }
        });
        cell.appendChild(courseDiv);
      }
    });
  });
}

// --- Real-Time Conflict Check for New Course Form ---
function checkNewCourseConflict() {
  const day = document.getElementById('day').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  
  if (!day || !startTime || !endTime) {
    conflictWarning.style.display = 'none';
    return;
  }
  
  const newStart = convertTimeToMinutes(startTime);
  const newEnd = convertTimeToMinutes(endTime);
  
  if (newStart >= newEnd) {
    conflictWarning.style.display = 'block';
    conflictWarning.textContent = 'Start time must be before end time';
    return;
  }
  
  fetchCourses().then(courses => {
    const dayCourses = courses.filter(course => course.day === day);
    let conflict = false;
    for (let course of dayCourses) {
      const courseStart = convertTimeToMinutes(course.startTime);
      const courseEnd = convertTimeToMinutes(course.endTime);
      if (newStart < courseEnd && courseStart < newEnd) {
        conflict = true;
        break;
      }
    }
    if (conflict) {
      conflictWarning.style.display = 'block';
      conflictWarning.textContent = 'Warning: This course conflicts with an existing course!';
    } else {
      conflictWarning.style.display = 'none';
    }
  });
}

// Helper to check for conflict before submission
async function hasConflict(day, startTime, endTime) {
  const courses = await fetchCourses();
  const dayCourses = courses.filter(course => course.day === day);
  const newStart = convertTimeToMinutes(startTime);
  const newEnd = convertTimeToMinutes(endTime);
  for (let course of dayCourses) {
    const courseStart = convertTimeToMinutes(course.startTime);
    const courseEnd = convertTimeToMinutes(course.endTime);
    if (newStart < courseEnd && courseStart < newEnd) {
      return true;
    }
  }
  return false;
}

// Attach real-time conflict checking listeners
document.getElementById('courseName').addEventListener('input', checkNewCourseConflict);
document.getElementById('day').addEventListener('change', checkNewCourseConflict);
document.getElementById('startTime').addEventListener('input', checkNewCourseConflict);
document.getElementById('endTime').addEventListener('input', checkNewCourseConflict);

// Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const courseName = document.getElementById('courseName').value;
  const day = document.getElementById('day').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;

  if (convertTimeToMinutes(startTime) >= convertTimeToMinutes(endTime)) {
    alert('Start time must be before end time');
    return;
  }

  const conflictExists = await hasConflict(day, startTime, endTime);
  if (conflictExists) {
    alert('This course conflicts with an existing course. Please choose a different time.');
    return;
  }

  await addCourse({ courseName, day, startTime, endTime });
  form.reset();
  conflictWarning.style.display = 'none';
  renderCourses();
});

// Initial rendering
renderCalendarGrid();
renderCourses();
