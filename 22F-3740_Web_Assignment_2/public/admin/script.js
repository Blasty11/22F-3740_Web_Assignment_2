document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');
        const target = link.getAttribute('href').substring(1);
        sections.forEach(section => {
          section.style.display = (section.id === target) ? 'block' : 'none';
        });
      });
    });
    fetchAdminCourses();
  });


  async function fetchAdminCourses() {
    const res = await fetch('/api/admin/courses');
    const courses = await res.json();
    const container = document.getElementById('admin-courses');
    container.innerHTML = '';
    if (courses.length === 0) {
      container.textContent = 'No courses available.';
      return;
    }
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Course Code</th>
          <th>Course Name</th>
          <th>Department</th>
          <th>Total Seats</th>
          <th>Enrolled</th>
          <th>Available</th>
          <th>Prerequisites</th>
          <th>Actions</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    courses.forEach(course => {
      const prereqNames = course.prerequisites && course.prerequisites.length
        ? course.prerequisites.map(pr => pr.courseName).join(', ')
        : 'None';
      const enrolled = course.enrolledCount || 0;
      const available = course.seatCount - enrolled;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${course.courseCode}</td>
        <td>${course.courseName}</td>
        <td>${course.department || 'N/A'}</td>
        <td>${course.seatCount}</td>
        <td>${enrolled}</td>
        <td>${available}</td>
        <td>${prereqNames}</td>
        <td>
          <button onclick="deleteCourse('${course._id}')">Delete</button>
          <button onclick="toggleUpdateForm('${course._id}')">Update</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  document.getElementById('admin-add-course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const courseCode = document.getElementById('admin-courseCode').value.trim();
    const courseName = document.getElementById('admin-courseName').value.trim();
    const seatCount = parseInt(document.getElementById('admin-seatCount').value);
    const department = document.getElementById('admin-department').value.trim();
    const prerequisitesInput = document.getElementById('admin-prerequisites').value;
    const prerequisites = prerequisitesInput ? prerequisitesInput.split(',').map(s => s.trim()) : [];
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseCode, courseName, seatCount, department, prerequisites })
    });
    if (res.ok) {
      document.getElementById('admin-add-course-form').reset();
      fetchAdminCourses();
    } else {
      const data = await res.json();
      alert(data.message || 'Error adding course');
    }
  });

  async function deleteCourse(id) {
    if (!confirm('Delete this course?')) return;
    await fetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    fetchAdminCourses();
  }

  function toggleUpdateForm(id) {
    const newCourseName = prompt('Enter new course name:');
    if (!newCourseName) return;
    const newSeatCount = prompt('Enter new seat count:');
    if (!newSeatCount) return;
    const newDepartment = prompt('Enter new department:');
    const newPrerequisites = prompt('Enter new prerequisites (Names comma-separated):', '');
    const courseCode = prompt('Enter new course code:');
    updateCourse(id, { courseCode, courseName: newCourseName, seatCount: parseInt(newSeatCount), department: newDepartment, prerequisites: newPrerequisites ? newPrerequisites.split(',').map(s => s.trim()) : [] });
  }

  async function updateCourse(id, data) {
    await fetch(`/api/admin/courses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    fetchAdminCourses();
  }

  document.getElementById('report-course-btn').addEventListener('click', async () => {
    const courseName = document.getElementById('report-courseName').value.trim();
    const resultDiv = document.getElementById('report-course-result');
    resultDiv.innerHTML = '';
    if (!courseName) {
      resultDiv.textContent = 'Please enter a course name.';
      return;
    }
    const res = await fetch(`/api/admin/reports/course-students?courseName=${encodeURIComponent(courseName)}`);
    const data = await res.json();
    if (!data.students || data.students.length === 0) {
      resultDiv.textContent = 'No students found for this course.';
    } else {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Username</th>
            <th>Roll Number</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      data.students.forEach(st => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${st.username}</td><td>${st.rollNumber}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      resultDiv.appendChild(table);
    }
  });

  document.getElementById('report-available-courses-btn').addEventListener('click', async () => {
    const resultDiv = document.getElementById('report-available-courses-result');
    resultDiv.innerHTML = '';
    const res = await fetch('/api/admin/reports/available-courses');
    const data = await res.json();
    if (!data || data.length === 0) {
      resultDiv.textContent = 'No courses with available seats.';
    } else {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Department</th>
            <th>Total Seats</th>
            <th>Enrolled</th>
            <th>Available</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      data.forEach(course => {
        const enrolled = course.enrolledCount || 0;
        const available = course.seatCount - enrolled;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${course.courseCode}</td>
          <td>${course.courseName}</td>
          <td>${course.department || 'N/A'}</td>
          <td>${course.seatCount}</td>
          <td>${enrolled}</td>
          <td>${available}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      resultDiv.appendChild(table);
    }
  });

  document.getElementById('report-prereq-btn').addEventListener('click', async () => {
    const resultDiv = document.getElementById('report-prereq-result');
    resultDiv.innerHTML = '';
    const res = await fetch('/api/admin/reports/prerequisites-not-completed');
    const data = await res.json();
    if (!data.students || data.students.length === 0) {
      resultDiv.textContent = 'No students found with incomplete prerequisites.';
    } else {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Roll Number</th>
            <th>Incomplete Prereq Count</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      data.students.forEach(st => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${st.rollNumber}</td><td>${st.notPassed.length}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      resultDiv.appendChild(table);
    }
  });

  document.getElementById('sm-search-btn').addEventListener('click', async () => {
    const rollNumber = document.getElementById('sm-roll-number').value.trim();
    const container = document.getElementById('student-management-container');
    container.innerHTML = '';
    if (!rollNumber) {
      container.textContent = 'Please enter a roll number.';
      return;
    }
    const res = await fetch(`/api/admin/student-courses?rollNumber=${encodeURIComponent(rollNumber)}`);
    const data = await res.json();
    if (!data.courses || data.courses.length === 0) {
      container.textContent = 'No registered courses found for this student.';
    } else {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Course Code</th>
            <th>Course Name</th>
            <th>Department</th>
            <th>Total Seats</th>
            <th>Enrolled</th>
            <th>Available</th>
            <th>Actions</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      data.courses.forEach(course => {
        const enrolled = course.enrolledCount || 0;
        const available = course.seatCount - enrolled;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${course.courseCode}</td>
          <td>${course.courseName}</td>
          <td>${course.department || 'N/A'}</td>
          <td>${course.seatCount}</td>
          <td>${enrolled}</td>
          <td>${available}</td>
          <td>
            <button onclick="dropStudent('${data.studentId}', '${course._id}')">Drop</button>
            ${
              course.prerequisites && course.prerequisites.length > 0
                ? `
                  <button onclick="passPrereq('${data.studentId}', '${course._id}')">Pass Prereq</button>
                  <button onclick="failPrereq('${data.studentId}', '${course._id}')">Fail Prereq</button>
                  `
                : ''
            }
          </td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }
  });

  async function dropStudent(studentId, courseId) {
    if (!confirm('Are you sure you want to drop this student from the course?')) return;
    const res = await fetch('/api/admin/student-course/drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, courseId })
    });
    if (res.ok) {
      alert('Student dropped successfully.');
      document.getElementById('sm-search-btn').click();
    } else {
      alert('Error dropping student from course.');
    }
  }

  async function passPrereq(studentId, courseId) {
    const resStatus = await fetch('/api/admin/student-course/prerequisites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, courseId, status: 'pass' })
    });
    if (resStatus.ok) {
      alert('Prerequisite status set to PASS.');
      document.getElementById('sm-search-btn').click();
    } else {
      alert('Error updating prerequisite status.');
    }
  }

  async function failPrereq(studentId, courseId) {
    const resStatus = await fetch('/api/admin/student-course/prerequisites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, courseId, status: 'fail' })
    });
    if (resStatus.ok) {
      alert('Prerequisite status set to FAIL.');
      document.getElementById('sm-search-btn').click();
    } else {
      alert('Error updating prerequisite status.');
    }
  }