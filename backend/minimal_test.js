const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const matcher = require('./matcher');
const cvGenerator = require('./cv_generator');

const app = express();
app.get('/api/health', (req, res) => {
  res.json({ ok: true, modules: ['express', 'better-sqlite3', 'multer', 'matcher', 'cv_generator'].join(',') });
});
module.exports = app;
