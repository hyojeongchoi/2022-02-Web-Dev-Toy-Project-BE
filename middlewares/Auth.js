const jwt = require('jsonwebtoken');
const redisClient = require('../redis/Redis');


function authenticateAccessToken(req, res, next) {
  const authHeader = req.headers['authorization']
  console.log("authHeader:", authHeader)
  const token = authHeader && authHeader.split('Bearer ')[1]
  if (token == null) return res.status(401).send({ error: 'Invalid Request.' })

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
    if (err) return res.status(400).send({ error: 'Bad Request.' })

    // redis 세션 검사
    // 1. token에서 user 파싱하고 userId 알아내기 (1 -> payload)
    var base64Payload = token.split('.')[1];
    var payload = Buffer.from(base64Payload, 'base64');
    var userId = JSON.parse(payload.toString()).id;
    
    // 2. redis에서 token을 찾고 대응되는 userId가 파싱해서 나온 userId와 같으면 로그인 상태 맞음
    var storedUserId = await redisClient.get(token);
    console.log(userId, storedUserId)
    if (userId == storedUserId) {
      req.token = token;
      req.user = user;
      next();
    }
    else {
      // 3. 로그인 상태 아니면 403
      return res.status(403).send({ error: 'Authentication fail.' });
    }
  })
}

module.exports = { authenticateAccessToken };