const jwt = require('jsonwebtoken');


// Access Token 생성 함수
function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
}

module.exports = { generateAccessToken };