const express = require('express');
const router = express.Router();

const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(process.env.BE_CLIENT_ID, process.env.BE_CLIENT_SECRET);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { authenticateAccessToken } = require('../middlewares/Auth');
const { generateAccessToken } = require('../util/Jwt');

const redisClient = require('../redis/Redis');

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const ejs = require('ejs')


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

// 이메일 인증코드 생성 및 발송
router.post('/email', authenticateAccessToken, async (req, res) => {
  const schoolEmail = req.body.email // 학교 이메일
  
  // 학교 이메일인지 확인
  const emailRegExp = new RegExp("^[a-zA-Z0-9._%+-]+@swu.ac.kr$");
  if (!emailRegExp.test(schoolEmail)) {
    res.status(403).send({error: 'Email is not valid'});
  }

  // 이메일 중복 확인
  try {
    const user = await prisma.users.findFirst({
      where: {
        schoolEmail: schoolEmail
      }
    });

    if (user != null) { // 중복
      res.status(403).send({error: 'Already used email.'});
    }

  } catch (err) {
    console.error(err);
    res.status(500).send({error: 'Server Error.'});
  }

  let authCode = crypto.randomBytes(3).toString('hex'); // 해시코드
  
  // 발송할 ejs 준비
  let emailTemplate;
  ejs.renderFile('./AuthMail.ejs', { authCode: authCode }, (err, data) => {
    if (err) {console.log(err)}
    emailTemplate = data;
  })
  
  // 발송할 메일 설정
  const mailOptions = {
    from: process.env.NODEMAILER_USER,
    to: schoolEmail,
    subject: "재학생 이메일 인증 코드",
    html: emailTemplate,
  };

  // 발송
  transport.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).send({error: 'Server Error.'});
    }
    else {
      console.log("NODE MAILER: '" + schoolEmail + "' Success");

      try {
        // redis 저장
        redisClient.set(schoolEmail, authCode, 'EX', 60 * 5 , async () => {
          console.log('Redis: { ' + schoolEmail + ', ' + authCode + ' } 저장 완료')
        })
      } catch (err) {
        res.status(500).send({error: 'Server Error.'});
      }

      res.send({
        message: 'Email Sent Successfully.'
      })
    }
    transport.close();
  });

});

const transport = nodemailer.createTransport({
  service: 'gmail',
  // host: 'smtp.gmail.com',
  // port: 587, // 보안 무시
  // secure: false
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  }
});


// 이메일 인증코드 확인 및 회원가입
router.post('/email/code', authenticateAccessToken, async (req, res) => {
  const schoolEmail = req.body.email // 학교 이메일
  const authCode = req.body.code // 사용자가 보낸 인증코드

  try {
    // 인증 코드 확인
    var storedAuthCode = await redisClient.get(schoolEmail);

    if (storedAuthCode != authCode) { // 인증 실패
      res.status(403).send({error: 'Code is not valid'});
    }

    // DB에 사용자 학교 이메일, 닉네임 저장 및 status 변경
    const user = await prisma.users.update({
      where: {
        userId: Number(req.user.id)
      },
      data: {
        schoolEmail: schoolEmail,
        nickname: '익명_' + req.user.id, // 최초 등록은 임의 설정
        status: '인증완료'
      }
    });
    // 인증코드 삭제
    redisClient.del(schoolEmail);

    res.send({
      data: {
        status: user.status,
        nickname: user.nickname,
        googleNickname: user.googleNickname,
        profileImagePath: user.profileImagePath
      },
      message: 'Registered Successfully.'
    })

  } catch (err) {
    console.error(err);
    res.status(500).send({error: 'Server Error.'});
  }
});

// 회원가입 API
// router.post('/register', authenticateAccessToken, async (req, res) => {

//   // 서비스 사용자 여부 확인
//   const user = await prisma.users.findUnique({
//     where: {
//       userId: req.user.id,
//     }
//   })

//   const nickname = req.body.nickname // 닉네임
//   const name = req.body.name // 실명
//   const studentId = req.body.studentId // 학번
//   const department = req.body.department // 학과

//   // DB에 저장
//   try {
//     await prisma.users.updateMany({
//       where: {
//         userId: req.user.id
//       },
//       data: {
//         nickname: nickname,
//         name: name,
//         studentId: studentId,
//         department: department,
//         status: '가입완료'
//       },
//     })
//     res.send({
//       data: {
//         status: user.status,
//         googleNickName: user.googleNickname
//       },
//       message: 'Registered Successfully.'
//     })

//   } catch (err) {
//     console.error(err);
//     res.status(500).send({error: 'Server Error.'});
//   }
    
// });

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