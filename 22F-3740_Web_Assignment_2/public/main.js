document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(nav => nav.classList.remove('active'));
      link.classList.add('active');

      const target = link.getAttribute('href').substring(1);
      sections.forEach(section => {
        section.style.display = section.id === target ? 'block' : 'none';
      });

      if (target === 'timetable-section') {
        populateUpdateCourseDropdown();
      }
      if (target === 'prerequisite-section') {
        populatePrereqDropdown();
      }
    });
  });

  sections.forEach((section, index) => {
    section.style.display = index === 0 ? 'block' : 'none';
  });

  loadRegistrationSection();
  populateDepartmentDropdown();
  renderCalendar();

  fetchStudentProfile().then(student => {
    if (student) {
      document.getElementById('student-username').textContent = student.username;
    }
  });
});

async function fetchStudentProfile() {
  const res = await fetch('/api/student/profile', { credentials: 'include' });
  if (res.ok) {
    return await res.json();
  } else {
    return null;
  }
}

async function fetchCourses() {
  const res = await fetch('/api/courses', { credentials: 'include' });
  return await res.json();
}

async function fetchStudentCourses() {
  const res = await fetch('/api/student/courses', { credentials: 'include' });
  return await res.json();
}

async function loadRegistrationSection() {
  const allCourses        = await fetchCourses();
  const registeredCourses = await fetchStudentCourses();
  const registeredIds     = registeredCourses.map(c => c._id.toString());

  // — AVAILABLE —
  const availableDiv = document.getElementById('available-courses');
  availableDiv.innerHTML = '<h3>Available Courses</h3>';

  allCourses.forEach(course => {
    if (registeredIds.includes(course._id.toString())) return;

    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', margin: '5px 0',
      padding: '8px', border: '1px solid #ccc',
      borderRadius: '4px'
    });

    const info = document.createElement('span');
    info.textContent = `${course.courseName} - Seats: ${course.seatCount} - Dept: ${course.department || 'N/A'}`;

    const btn = document.createElement('button');
    btn.textContent = 'Register Course';
    btn.style.marginLeft = '10px';

    btn.addEventListener('click', async () => {
      // 1) fetch prereq chain
      let chain = [];
      try {
        const prRes = await fetch(`/api/course-prerequisite-chain?courseId=${course._id}`, { credentials: 'include' });
        chain = (await prRes.json()).chain || [];
      } catch (err) {
        alert('Could not verify prerequisites. Try again later.');
        return;
      }

      if (chain.length > 0) {
        alert('This course has prerequisites.');
        const passed = confirm('Have you already passed all prerequisites? OK = Yes, Cancel = No.');

        if (!passed) {
          // auto‑register all prereqs
          for (let prereq of chain) {
            if (registeredIds.includes(prereq._id.toString())) continue;
            const r = await fetch('/api/register-course', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseId: prereq._id })
            });
            if (!r.ok) {
              const d = await r.json().catch(() => ({}));
              alert(`Failed to auto-register ${prereq.courseName}: ${d.message}`);
              return;
            }
          }
          alert('Prerequisites auto-registered. Complete them first, then register this course.');
          return;
        }

        // 2) record Pass status *for each* prereq course
        for (let prereq of chain) {
          await fetch('/api/student/prerequisite-status', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId: prereq._id, status: 'Pass' })
          });
        }
      }

      // 3) now register the original course
      try {
        const res = await fetch('/api/register-course', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course._id })
        });
        const data = await res.json();
        alert(data.message);
        loadRegistrationSection();
        renderCalendar();
      } catch {
        alert('Network error. Try again.');
      }
    });

    container.appendChild(info);
    container.appendChild(btn);
    availableDiv.appendChild(container);
  });

  // — REGISTERED (unchanged) —
  const regDiv = document.getElementById('registered-courses');
  regDiv.innerHTML = '<h3>Registered Courses</h3>';
  if (!registeredCourses.length) {
    regDiv.innerHTML += '<p>No courses registered.</p>';
  } else {
    registeredCourses.forEach(course => {
      const c = document.createElement('div');
      Object.assign(c.style, {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', margin: '5px 0',
        padding: '8px', border: '1px solid #ccc',
        borderRadius: '4px', backgroundColor: 'lightgreen'
      });

      const info = document.createElement('span');
      info.textContent = `${course.courseName} - Seats: ${course.seatCount}`;

      const dropBtn = document.createElement('button');
      dropBtn.textContent = 'Drop Course';
      dropBtn.style.marginLeft = '10px';
      dropBtn.addEventListener('click', async () => {
        if (!confirm('Drop this course?')) return;
        const res = await fetch('/api/unregister-course', {
          method: 'DELETE', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course._id })
        });
        if (res.ok) {
          alert('Course dropped.');
          loadRegistrationSection();
          renderCalendar();
        } else {
          alert('Error dropping course.');
        }
      });

      c.appendChild(info);
      c.appendChild(dropBtn);
      regDiv.appendChild(c);
    });
  }
}



async function populateDepartmentDropdown() {
  try {
    const res = await fetch('/api/departments', { credentials: 'include' });
    const departments = await res.json();
    const deptSelect = document.getElementById('search-department');
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
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Course Name</th><th>Department</th><th>Seats</th></tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  filtered.forEach(course => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${course.courseName}</td><td>${course.department || 'N/A'}</td><td>${course.seatCount}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  resultsDiv.appendChild(table);
});

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

      courseDiv.addEventListener('click', async () => {
        if (confirm('Do you want to drop this course?')) {
          const res = await fetch('/api/unregister-course', {
            method: 'DELETE',
            credentials: 'include',
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

async function populateUpdateCourseDropdown() {
  const courses = await fetchStudentCourses();
  const courseDropdown = document.getElementById('update-courseName');
  courseDropdown.innerHTML = '<option value="">Select a registered course</option>';
  courses.forEach(course => {
    const option = document.createElement('option');
    option.value = course._id;
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
    credentials: 'include',
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

async function populatePrereqDropdown() {
  const select = document.getElementById('prereq-course-select');
  const chainList = document.getElementById('prereq-chain-result');

  // 1) reset dropdown & list
  select.innerHTML = '<option value="">-- Select a course --</option>';
  chainList.innerHTML = '';

  // 2) fill dropdown with all courses
  try {
    const courses = await fetchCourses();
    courses.forEach(course => {
      const opt = document.createElement('option');
      opt.value = course._id;
      opt.textContent = `${course.courseName} (${course.courseCode})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading courses for prereq dropdown:', err);
    chainList.innerHTML = '<li>Error loading courses.</li>';
    return;
  }

  // 3) when user picks a course, fetch & display its prereq chain
  select.addEventListener('change', async () => {
    const courseId = select.value;
    chainList.innerHTML = '';

    if (!courseId) {
      // nothing selected
      return;
    }

    try {
      const res = await fetch(
        `/api/course-prerequisite-chain?courseId=${encodeURIComponent(courseId)}`,
        { credentials: 'include' }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch chain');
      }

      const chain = data.chain;
      if (chain.length === 0) {
        chainList.innerHTML = '<li>No prerequisites for this course.</li>';
      } else {
        chain.forEach(pr => {
          const li = document.createElement('li');
          li.textContent = `${pr.courseName} (${pr.courseCode})`;
          chainList.appendChild(li);
        });
      }
    } catch (err) {
      console.error('Error fetching prerequisite chain:', err);
      chainList.innerHTML = `<li>Error: ${err.message}</li>`;
    }
  });
}