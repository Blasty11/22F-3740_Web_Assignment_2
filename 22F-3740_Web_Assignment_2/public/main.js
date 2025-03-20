// main.js

// active nav link
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove 'active' class from all nav links
      navLinks.forEach(nav => nav.classList.remove('active'));
      // Add 'active' to the clicked link
      link.classList.add('active');
      
      // Show/hide sections
      const target = link.getAttribute('href').substring(1);
      sections.forEach(section => {
        section.style.display = (section.id === target) ? 'block' : 'none';
      });
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  // Navigation: Show/hide sections based on nav link clicked
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href').substring(1);
      sections.forEach(section => {
        section.style.display = (section.id === target) ? 'block' : 'none';
      });
      // When timetable section is shown, populate the update dropdown
      if (target === 'timetable-section') {
        populateUpdateCourseDropdown();
      }
    });
  });

  // Initialize sections on page load
  loadRegistrationSection();
  populateDepartmentDropdown();
  renderCalendar();
});

// ===============================
// Registration Section Code
// ===============================

// Fetch all courses (for registration and search)
async function fetchCourses() {
  const res = await fetch('/api/courses');
  return await res.json();
}

// Fetch the student's registered courses
async function fetchStudentCourses() {
  const res = await fetch('/api/student/courses');
  return await res.json();
}

// Populate the Available and Registered Courses divisions
async function loadRegistrationSection() {
  // Fetch all courses and registered courses
  const allCourses = await fetchCourses();
  const registeredCourses = await fetchStudentCourses();
  const registeredIds = registeredCourses.map(course => course._id.toString());

  // Populate Available Courses (only courses not registered)
  const availableCoursesDiv = document.getElementById('available-courses');
  availableCoursesDiv.innerHTML = '<h3>Available Courses</h3>';
  allCourses.forEach(course => {
    if (!registeredIds.includes(course._id.toString())) {
      // Create a container div
      const containerDiv = document.createElement('div');
      containerDiv.style.display = 'flex';
      containerDiv.style.justifyContent = 'space-between';
      containerDiv.style.alignItems = 'center';
      containerDiv.style.margin = '5px 0';
      containerDiv.style.padding = '8px';
      containerDiv.style.border = '1px solid #ccc';
      containerDiv.style.borderRadius = '4px';

      // Text span for course details
      const textSpan = document.createElement('span');
      textSpan.textContent = `${course.courseName} - Seats: ${course.seatCount} - Dept: ${course.department || 'N/A'}`;

      // Register button
      const registerBtn = document.createElement('button');
      registerBtn.textContent = 'Register Course';
      registerBtn.style.marginLeft = '10px';
      registerBtn.addEventListener('click', async () => {
        const res = await fetch('/api/register-course', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course._id })
        });
        if (res.ok) {
          alert('Course registered successfully!');
          loadRegistrationSection();
          renderCalendar();
        } else {
          alert('Error registering course');
        }
      });

      containerDiv.appendChild(textSpan);
      containerDiv.appendChild(registerBtn);
      availableCoursesDiv.appendChild(containerDiv);
    }
  });

  // Populate Registered Courses
  const registeredCoursesDiv = document.getElementById('registered-courses');
  registeredCoursesDiv.innerHTML = '<h3>Registered Courses</h3>';
  if (registeredCourses.length === 0) {
    registeredCoursesDiv.innerHTML += '<p>No courses registered.</p>';
  } else {
    registeredCourses.forEach(course => {
      // Create a container div
      const containerDiv = document.createElement('div');
      containerDiv.style.display = 'flex';
      containerDiv.style.justifyContent = 'space-between';
      containerDiv.style.alignItems = 'center';
      containerDiv.style.margin = '5px 0';
      containerDiv.style.padding = '8px';
      containerDiv.style.border = '1px solid #ccc';
      containerDiv.style.borderRadius = '4px';
      // Highlight registered courses in green
      containerDiv.style.backgroundColor = 'lightgreen';

      // Text span for course details
      const textSpan = document.createElement('span');
      textSpan.textContent = `${course.courseName} - Seats: ${course.seatCount} - Dept: ${course.department || 'N/A'}`;

      // Drop button
      const dropBtn = document.createElement('button');
      dropBtn.textContent = 'Drop Course';
      dropBtn.style.marginLeft = '10px';
      dropBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to drop this course?')) {
          const res = await fetch('/api/unregister-course', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId: course._id })
          });
          if (res.ok) {
            alert('Course dropped successfully!');
            loadRegistrationSection();
            renderCalendar();
          } else {
            alert('Error dropping course');
          }
        }
      });

      containerDiv.appendChild(textSpan);
      containerDiv.appendChild(dropBtn);
      registeredCoursesDiv.appendChild(containerDiv);
    });
  }
}

// ===============================
// Search Section Code
// ===============================

async function populateDepartmentDropdown() {
  try {
    const res = await fetch('/api/departments');
    const departments = await res.json();
    const deptSelect = document.getElementById('search-department');
    // "All Departments" option should already be in HTML
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

document.getElementById('search-btn').addEventListener('click', async () => {
  const query = document.getElementById('search-query').value.toLowerCase().trim();
  const selectedDept = document.getElementById('search-department').value;
  const seatFilter = document.getElementById('search-seats').value;

  const courses = await fetchCourses();
  const resultsDiv = document.getElementById('search-results');
  resultsDiv.innerHTML = '';

  let filtered = courses;
  if (selectedDept !== 'All') {
    filtered = filtered.filter(course => course.department && course.department === selectedDept);
  }
  if (query.length > 0) {
    filtered = filtered.filter(course => {
      const nameMatch = course.courseName.toLowerCase().includes(query);
      const deptMatch = course.department && course.department.toLowerCase().includes(query);
      return nameMatch || deptMatch;
    });
  }
  if (seatFilter === 'available') {
    filtered = filtered.filter(course => course.seatCount > 0);
  } else if (seatFilter === 'full') {
    filtered = filtered.filter(course => course.seatCount === 0);
  }

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

const startHour = 8;
const endHour = 18;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

async function renderCalendar() {
  renderCalendarGrid();
  const courses = await fetchStudentCourses();
  const conflictIds = detectConflicts(courses);

  courses.forEach(course => {
    const courseStart = convertTimeToMinutes(course.startTime);
    const courseEnd = convertTimeToMinutes(course.endTime);
    const slotDuration = 60;
    const topOffset = ((courseStart - startHour * 60) / slotDuration) * 50;
    const height = ((courseEnd - courseStart) / slotDuration) * 50 - 4;

    const cellSelector = `.day-cell[data-day="${course.day}"][data-hour="${Math.floor(courseStart / 60)}"]`;
    const dayCells = document.querySelectorAll(cellSelector);
    dayCells.forEach(cell => {
      const courseDiv = document.createElement('div');
      courseDiv.className = 'course-event';
      courseDiv.textContent = `${course.courseName} (${course.startTime}-${course.endTime})`;
      if (conflictIds.has(course._id)) courseDiv.classList.add('conflict');
      courseDiv.style.position = 'absolute';
      courseDiv.style.top = (topOffset % 50) + 'px';
      courseDiv.style.height = height + 'px';
      courseDiv.style.width = '100%';

      // Drop course on click
      courseDiv.addEventListener('click', async () => {
        if (confirm('Do you want to drop this course?')) {
          const res = await fetch('/api/unregister-course', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId: course._id })
          });
          if (res.ok) {
            alert('Course dropped successfully!');
            loadRegistrationSection();
            renderCalendar();
          } else {
            alert('Error dropping course');
          }
        }
      });
      cell.style.position = 'relative';
      cell.appendChild(courseDiv);
    });
  });
}

function renderCalendarGrid() {
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.innerHTML = '';
  for (let hour = startHour; hour < endHour; hour++) {
    const row = document.createElement('div');
    row.className = 'calendar-row';

    const timeCell = document.createElement('div');
    timeCell.className = 'time-cell';
    timeCell.textContent = hour + ':00';
    row.appendChild(timeCell);

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

function convertTimeToMinutes(timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
}

function detectConflicts(courses) {
  const conflicts = new Set();
  days.forEach(day => {
    const dayCourses = courses.filter(course => course.day === day);
    for (let i = 0; i < dayCourses.length; i++) {
      const aStart = convertTimeToMinutes(dayCourses[i].startTime);
      const aEnd = convertTimeToMinutes(dayCourses[i].endTime);
      for (let j = i + 1; j < dayCourses.length; j++) {
        const bStart = convertTimeToMinutes(dayCourses[j].startTime);
        const bEnd = convertTimeToMinutes(dayCourses[j].endTime);
        if (aStart < bEnd && bStart < aEnd) {
          conflicts.add(dayCourses[i]._id);
          conflicts.add(dayCourses[j]._id);
        }
      }
    }
  });
  return conflicts;
}

// ===============================
// Update Timetable Form Code
// ===============================

async function populateUpdateCourseDropdown() {
  const courses = await fetchStudentCourses();
  const courseDropdown = document.getElementById('update-courseName');
  courseDropdown.innerHTML = '<option value="">Select a registered course</option>';
  courses.forEach(course => {
    const option = document.createElement('option');
    option.value = course._id; // Use course ID for reliable update
    option.textContent = course.courseName;
    courseDropdown.appendChild(option);
  });
}

document.getElementById('update-timetable-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const courseId = document.getElementById('update-courseName').value;
  const startTime = document.getElementById('update-startTime').value;
  const endTime = document.getElementById('update-endTime').value;
  const day = document.getElementById('update-day').value;

  if (!courseId || !startTime || !endTime || !day) {
    alert('All fields are required.');
    return;
  }

  // Conflict Check: Fetch student's registered courses and exclude the course being updated
  const courses = await fetchStudentCourses();
  const courseToUpdate = courses.find(c => c._id.toString() === courseId);
  if (!courseToUpdate) {
    alert('Course not registered.');
    return;
  }
  const otherCourses = courses.filter(c => c._id.toString() !== courseId);
  const updatedStart = convertTimeToMinutes(startTime);
  const updatedEnd = convertTimeToMinutes(endTime);

  for (const course of otherCourses) {
    if (course.day === day) {
      const otherStart = convertTimeToMinutes(course.startTime);
      const otherEnd = convertTimeToMinutes(course.endTime);
      if (updatedStart < otherEnd && otherStart < updatedEnd) {
        alert('Conflict detected with another course. Timetable not updated.');
        return;
      }
    }
  }

  const res = await fetch('/api/student/update-timetable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, startTime, endTime, day })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.message);
    document.getElementById('update-timetable-form').reset();
    loadRegistrationSection();
    renderCalendar();
  } else {
    alert(data.message || 'Error updating timetable');
  }
});
