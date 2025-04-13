const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { isStudentAuthenticated } = require('../middleware/auth');

router.post('/login', studentController.postLogin);
router.get('/logout', studentController.getLogout);

router.get('/schedule', isStudentAuthenticated, studentController.getSchedulePage);

router.get('/api/student/profile', isStudentAuthenticated, studentController.getStudentProfile);
router.get('/api/courses', isStudentAuthenticated, studentController.getAllCourses);
router.post('/api/register-course', isStudentAuthenticated, studentController.postRegisterCourse);
router.post('/api/student/prerequisite-status', isStudentAuthenticated, studentController.postPrerequisiteStatus
);
router.post('/api/courses', isStudentAuthenticated, studentController.postCreateCourse);
router.delete('/api/courses/:id', isStudentAuthenticated, studentController.deleteCourse);
router.get('/api/student/courses', isStudentAuthenticated, studentController.getStudentCourses);
router.get('/api/departments', isStudentAuthenticated, studentController.getDepartments);
router.delete('/api/unregister-course', isStudentAuthenticated, studentController.deleteUnregisterCourse);
router.post('/api/student/update-timetable', isStudentAuthenticated, studentController.postUpdateTimetable);
router.post('/api/subscribe-course', isStudentAuthenticated, studentController.postSubscribeCourse);

router.get('/api/all-courses', isStudentAuthenticated, studentController.getAllCoursesForPrereq);
router.get('/api/course-prerequisite-chain', isStudentAuthenticated, studentController.getCoursePrerequisiteChain);

module.exports = router;
