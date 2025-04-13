const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');
const adminController = require('../controllers/adminController');
const { isAdminAuthenticated } = require('../middleware/auth');

router.get('/admin/login', mainController.getAdminLoginPage);
router.post('/admin/login', adminController.postAdminLogin);

router.get('/admin/logout', adminController.getAdminLogout);

router.get('/admin/dashboard', isAdminAuthenticated, mainController.getAdminDashboardPage);

router.get('/api/admin/student-courses', isAdminAuthenticated, adminController.getStudentCoursesForAdmin);
router.post('/api/admin/student-course/drop', isAdminAuthenticated, adminController.deleteStudentCourseForAdmin);
router.post('/api/admin/student-course/prerequisites', isAdminAuthenticated, adminController.postStudentCoursePrerequisitesForAdmin);

router.get('/api/admin/reports/prerequisites-not-completed', isAdminAuthenticated, adminController.getReportPrereqsNotCompleted);
router.get('/api/admin/reports/course-students', isAdminAuthenticated, adminController.getReportCourseStudents);
router.get('/api/admin/reports/available-courses', isAdminAuthenticated, adminController.getReportAvailableCourses);

router.get('/api/admin/courses', isAdminAuthenticated, adminController.getAdminCourses);
router.post('/api/admin/courses', isAdminAuthenticated, adminController.postAdminCourses);
router.put('/api/admin/courses/:id', isAdminAuthenticated, adminController.putAdminCourses);
router.delete('/api/admin/courses/:id', isAdminAuthenticated, adminController.deleteAdminCourses);

module.exports = router;
