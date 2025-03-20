// main.js

document.addEventListener('DOMContentLoaded', () => {
  // Navigation: Show/hide sections based on nav link clicked
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href').substring(1);
      sections.forEach(section => {
        section.style.display = section.id === target ? 'block' : 'none';
      });
    });
  });

  // Initialize sections
  loadRegistrationSection();
  populateDepartmentDropdown();
  renderCalendar();
});

// ===============================
// Registration Section Code
// ===============================

// Fetch courses from the server (expects courses to have fields: _id, courseName, seatCount, department, etc.)
async function fetchCourses() {
  const res = await fetch('/api/courses');
  const courses = await res.json();
  return courses;
}

// Populate the course dropdown and available courses list for registration
async function loadRegistrationSection() {
  const courses = await fetchCourses();
  const courseSelect = document.getElementById('course-select');
  const availableCoursesDiv = document.getElementById('available-courses');

  // Clear current options and list
  courseSelect.innerHTML = '<option value="">Select a course</option>';
  availableCoursesDiv.innerHTML = '<h3>Available Courses</h3>';

  courses.forEach(course => {
    // Add option to dropdown
    const option = document.createElement('option');
    option.value = course._id;
    option.textContent = `${course.courseName} - Seats: ${course.seatCount} - Dept: ${course.department || 'N/A'}`;
    courseSelect.appendChild(option);

    // Display course details in the available courses list
    const courseDiv = document.createElement('div');
    courseDiv.textContent = `${course.courseName} - Seats: ${course.seatCount} - Dept: ${course.department || 'N/A'}`;
    availableCoursesDiv.appendChild(courseDiv);
  });
}

// Handle registration form submission
document.getElementById('register-course-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const courseId = document.getElementById('course-select').value;
  if (!courseId) {
    alert('Please select a course');
    return;
  }
  const res = await fetch('/api/register-course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId })
  });
  if (res.ok) {
    alert('Course registered successfully!');
    loadRegistrationSection(); // Refresh the list if needed
  } else {
    alert('Error registering course');
  }
});

// ===============================
// Search Section Code
// ===============================

// Populate the department dropdown in the search section dynamically
async function populateDepartmentDropdown() {
  try {
    const res = await fetch('/api/departments');
    const departments = await res.json();

    const deptSelect = document.getElementById('search-department');
    // Already have default "All Departments" option in HTML
    departments.forEach(dept => {
      if (!dept || dept.trim() === '') return;
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = dept;
      deptSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
  }
}

// Search button click handler
document.getElementById('search-btn').addEventListener('click', async () => {
  // Get user inputs
  const query = document.getElementById('search-query').value.toLowerCase().trim();
  const selectedDept = document.getElementById('search-department').value;
  const seatFilter = document.getElementById('search-seats').value;

  // Fetch all courses
  const courses = await fetchCourses();
  const resultsDiv = document.getElementById('search-results');
  resultsDiv.innerHTML = '';

  // 1) Filter by department (if not 'All')
  let filtered = courses;
  if (selectedDept !== 'All') {
    filtered = filtered.filter(course => 
      course.department && course.department === selectedDept
    );
  }

  // 2) Filter by text query (course name or department substring)
  if (query.length > 0) {
    filtered = filtered.filter(course => {
      const nameMatch = course.courseName.toLowerCase().includes(query);
      const deptMatch = course.department && course.department.toLowerCase().includes(query);
      return (nameMatch || deptMatch);
    });
  }

  // 3) Filter by seat availability
  if (seatFilter === 'available') {
    filtered = filtered.filter(course => course.seatCount > 0);
  } else if (seatFilter === 'full') {
    filtered = filtered.filter(course => course.seatCount === 0);
  }

  // Display results
  if (filtered.length === 0) {
    resultsDiv.textContent = 'No courses found.';
    return;
  }

  filtered.forEach(course => {
    const div = document.createElement('div');
    div.textContent = `${course.courseName} - Dept: ${course.department || 'N/A'} - Seats: ${course.seatCount}`;
    resultsDiv.appendChild(div);
  });
});

// ===============================
// Timetable Section Code
// ===============================

const startHour = 8; // 8 AM
const endHour = 18;  // 6 PM
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Render the empty calendar grid
function renderCalendarGrid() {
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.innerHTML = '';
  for (let hour = startHour; hour < endHour; hour++) {
    const row = document.createElement('div');
    row.className = 'calendar-row';

    // Time label cell
    const timeCell = document.createElement('div');
    timeCell.className = 'time-cell';
    timeCell.textContent = hour + ':00';
    row.appendChild(timeCell);

    // Create day cells for each day
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

// Render the courses on the timetable calendar
async function renderCalendar() {
  renderCalendarGrid();
  const courses = await fetchCourses();
  const conflictIds = detectConflicts(courses);

  courses.forEach(course => {
    const courseStart = convertTimeToMinutes(course.startTime);
    const courseEnd = convertTimeToMinutes(course.endTime);
    const slotDuration = 60; // minutes
    const topOffset = ((courseStart - startHour * 60) / slotDuration) * 50;
    const height = ((courseEnd - courseStart) / slotDuration) * 50 - 4;

    // Identify the correct cell based on course day and start time hour
    const cellSelector = `.day-cell[data-day="${course.day}"][data-hour="${Math.floor(courseStart / 60)}"]`;
    const dayCells = document.querySelectorAll(cellSelector);

    dayCells.forEach(cell => {
      const courseDiv = document.createElement('div');
      courseDiv.className = 'course-event';
      courseDiv.textContent = `${course.courseName} (${course.startTime}-${course.endTime})`;
      if (conflictIds.has(course._id)) {
        courseDiv.classList.add('conflict');
      }
      courseDiv.style.position = 'absolute';
      courseDiv.style.top = (topOffset % 50) + 'px';
      courseDiv.style.height = height + 'px';
      courseDiv.style.width = '100%';
      cell.style.position = 'relative';
      cell.appendChild(courseDiv);
    });
  });
}

// Utility: Convert time string "HH:MM" to minutes since midnight
function convertTimeToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

// Detect scheduling conflicts among courses (used for calendar display)
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
