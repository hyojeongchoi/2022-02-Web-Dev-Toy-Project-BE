const express = require('express');
const app = express();
app.use(express.json());

const PORT = 8081

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(process.env.BE_CLIENT_ID, process.env.BE_CLIENT_SECRET);

// 로그인 API
app.post('/auth/user/login', async (req, res) => {
  let name = ""
  let email = ""

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

  responseContent = {}
  try {
    // 서비스 사용자 여부 확인
    const user = await prisma.users.findFirst({
      where: {
        googleEmail: email,
      }
    })
    
    if (user == null) { // 비회원
      const status = '로그인완료'
      // DB 저장
      await prisma.users.create({
        data: {
            googleEmail: email,
            googleNickname: name,
            profileImagePath: picture,
            status: status
        },
      })

      // 로그인 세션 생성

      // access token(미구현), status 반환
      responseContent = {status: status}
      // (추후 FE에서 가입 폼 작성 후 /auth/user/register에 접근)
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

      // 로그인 세션 생성

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

// 회원가입
app.post('/auth/user/register', async (req, res) => {
  const accessToken = req.body.accessToken
  let email = ""
  email = req.body.googleEmail // 이메일 (다음 수정시 삭제)
  try {
    // email = JwtUtil.validate(accessToken)

    // 세션 확인

  } catch (err) {
    res.status(403).send({error: 'Invalid Request.'});
    return;
  }

  // 서비스 사용자 여부 확인
  const user = await prisma.users.findFirst({
    where: {
      googleEmail: email,
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
        googleEmail: email
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
