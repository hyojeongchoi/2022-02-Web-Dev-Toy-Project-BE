const Multer = require('multer');


// Multer
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // no larger than 10mb
  }
});

module.exports = multer;