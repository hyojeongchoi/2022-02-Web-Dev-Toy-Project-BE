const express = require('express');
const router = express.Router();

const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(process.env.BE_CLIENT_ID, process.env.BE_CLIENT_SECRET);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { authenticateAccessToken } = require('../middlewares/Auth');
const { generateAccessToken } = require('../util/Jwt');

const redisClient = require('../redis/Redis');


// 로그아웃 API
router.post('/logout', authenticateAccessToken, async (req, res) => {
  // body로 받은 accessToken을 redis에서 찾아 해당 key-value 쌍 삭제
  // 기획 간소화로 refresh token 사용 X
  try {
    redisClient.del(`${req.body.accessToken}`);
  }
  catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Server Error.' });
  }
  res.send({ message: 'Signed Out Successfully.' });
});

// 로그인 API
router.post('/login', async (req, res) => {
  let name = ""
  let email = ""
  let picture = ""

  // 구글 credential 인증
  try {
    const credential = req.body.credential

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.FE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    console.log(payload)

    // const userId = payload['sub']; // 필요 없음
    name = payload['name'];
    email = payload['email'];
    picture = payload['picture'];

  } catch (err) {
    console.error(err);
    res.status(403).send({error: 'Invalid Credential.'});
    return;
  }

  let user = {};
  let responseContent = {};
  try {
    // 서비스 사용자 여부 확인
    user = await prisma.users.findFirst({
      where: {
        googleEmail: email,
      }
    })
    
    if (user == null) { // 비회원
      const status = '로그인완료'
      // DB 저장
      user = await prisma.users.create({
        data: {
            googleEmail: email,
            googleNickname: name,
            profileImagePath: picture,
            status: status
        }
      })
      
      // status 반환
      responseContent = {status: status}
      // 추후 FE에서 가입 폼 작성 후 /auth/user/register에 접근
    }
    else { // 로그인완료 or 가입완료 회원
      // DB 업데이트
      await prisma.users.updateMany({
        where: {
          googleEmail: email
        },
        data: {
          googleNickname: name,
        }
      })

      if (user.status == "로그인완료") {
        responseContent = {status: user.status}
      }
      else {
        responseContent = {
          status: user.status,
          googleNickName: user.googleNickname
        }
      }
    }

    // accessToken 발급
    const userInfo = {id: user.userId};
    const accessToken = generateAccessToken(userInfo);
    responseContent['accessToken'] = accessToken;

    // redis 로그인 세션 생성
    // https://redis.io/commands/set/ 참고
    redisClient.set(accessToken, user.userId.toString(), 'EX', 60 * 60 , async () => {
      console.log('Redis: { ' + accessToken + ', ' + user.userId + ' } 저장 완료')
    })

  } catch (err) {
    console.error(err);
    res.status(500).send({error: 'Server Error.'});
    return;
  }

  res.send({
    data: responseContent,
    message: 'Signed in Successfully.'
  })

});

// 회원가입 API
router.post('/register', authenticateAccessToken, async (req, res) => {

  // 서비스 사용자 여부 확인
  const user = await prisma.users.findUnique({
    where: {
      userId: req.user.id,
    }
  })

  const nickname = req.body.nickname // 닉네임
  const name = req.body.name // 실명
  const studentId = req.body.studentId // 학번
  const department = req.body.department // 학과

  // DB에 저장
  try {
    await prisma.users.updateMany({
      where: {
        userId: req.user.id
      },
      data: {
        nickname: nickname,
        name: name,
        studentId: studentId,
        department: department,
        status: '가입완료'
      },
    })
    res.send({
      data: {
        status: user.status,
        googleNickName: user.googleNickname
      },
      message: 'Registered Successfully.'
    })

  } catch (err) {
    console.error(err);
    res.status(500).send({error: 'Server Error.'});
  }
    
});

// Access Token 재발행 API
router.post('/token', authenticateAccessToken, (req, res) => {
  // access token 재발행
  const accessToken = generateAccessToken({ id: req.user.id })
  // 이전 redis 세션 삭제
  redisClient.del(req.body.accessToken);
  // redis에 새 세션 저장
  redisClient.set(accessToken, req.user.id.toString(), 'EX', 60 * 60, async () => {
    console.log('Redis: { ' + accessToken + ', ' + req.user.id + ' } 저장 완료')
  })
  // FE에 새로 발급한 token 돌려주기
  res.send({ accessToken: accessToken });
})

module.exports = router;