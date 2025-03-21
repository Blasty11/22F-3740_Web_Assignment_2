function isStudentAuthenticated(req, res, next) {
    if (req.session && req.session.student) {
      return next();
    }
    return res.redirect('/');
  }
  
  function isAdminAuthenticated(req, res, next) {
    if (req.session && req.session.admin) {
      return next();
    }
    return res.redirect('/admin/login');
  }
  
  module.exports = {
    isStudentAuthenticated,
    isAdminAuthenticated
  };
  