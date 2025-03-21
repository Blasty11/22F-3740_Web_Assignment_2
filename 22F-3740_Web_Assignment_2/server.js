const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const http = require('http');

const connectDB = require('./config/db');

const mainRoutes = require('./routes/mainRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');

connectDB();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'x7k9p!mQzL$2vN8rT5jY&wB3qF',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', mainRoutes);
app.use('/', studentRoutes);
app.use('/', adminRoutes);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
