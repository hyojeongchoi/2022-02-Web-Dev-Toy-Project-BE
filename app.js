const express = require('express');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const Multer = require('multer');

// env
const dotenv = require("dotenv");
dotenv.config();

// GCP Storage
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_STORAGE_BUCKET); // dotenv 필요

const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = 8081

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(process.env.BE_CLIENT_ID, process.env.BE_CLIENT_SECRET);

// Multer
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // no larger than 10mb
  },
});

// GCP image upload test
app.post('/upload', multer.single('file'), (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }
  console.log(req.file)

  const fileExtension = req.file.originalname.split('.').pop();
  const fileName = uuidv4(); // uuid4
  const filePath = `posts/test/${fileName}.${fileExtension}`;
  const blob = bucket.file(filePath);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on('error', err => {
    next(err);
  });

  blobStream.on('finish', () => {
    res.status(200).send(`https://storage.googleapis.com/${bucket.name}/` + filePath);
  });

  blobStream.end(req.file.buffer);
});


//////////////////////////////// REDIS //////////////////////////////////

// Redis 연결
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
  legacyMode: false, // Promise
});
redisClient.on('connect', () => {
  console.info('Redis connected!');
});
redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});
redisClient.connect();


// 로그아웃 API
app.post('/auth/user/logout', authenticateAccessToken, async (req, res) => {
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

////////////////// accessToken 유효성 검사 ///////////////////////////
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

// Access Token 생성 함수
function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
}

// 재발행
app.post('/token', authenticateAccessToken, (req, res) => {
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


///////////////////////////// Image Upload //////////////////////////////

// 이미지 업로드 & URL 반환하는 함수
function uploadImage(req, res, next) {
  // file이 존재해야만 업로드
  if(req.file != undefined){
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = uuidv4(); // uuid4
    const filePath = `posts/test/${fileName}.${fileExtension}`;
    const blob = bucket.file(filePath);
    const blobStream = blob.createWriteStream({
        resumable: false,
    });
  
    blobStream.on('error', err => {
        next(err);
    });
  
    blobStream.on('finish', () => {
        const image = `https://storage.googleapis.com/${bucket.name}/` + filePath;
        req.image = image;
        next();
    });
  
    blobStream.end(req.file.buffer);
  }
};

// GCP Storage 파일 삭제하는 함수 -> 삭제 딜레이 2-30분 있는지 확인하기
async function deleteFile(image) {
  if (image != null) {
    const fileNameWithPath = image.split(`https://storage.googleapis.com/${bucket.name}/`)[1];
    await storage.bucket(bucket.name).file(fileNameWithPath).delete();
    console.log(`gs://${bucket.name}/${fileNameWithPath} deleted`);
  }
}

// prisma에 업데이트하는 함수
async function prismaUpdate(postId, req, res){
  const json = JSON.parse(req.body.json);
  if(req.image == undefined)
  {
    req.image = null;
  }

  try {
    const userId = Number(req.user.id)
    const title = json.title
    const content = json.content
    const place = json.place
    const status = json.status
    const image = req.image
    const postRes = await prisma.posts.findUnique({
      where: {
        postId: postId
      }
    });
    if (postRes.userId == userId) { // 게시글 작성자인지 확인
      await prisma.posts.update({
        where: {
          postId: postId,
        },
        data: {
          title: title,
          content: content,
          imagePath: image,
          place: place,
          status: status
        }
      });
      res.send({message: 'Updated Successfully.'})
    }
    else {
      res.status(403).send({error: 'Authentication fail.'})
    }

  } catch (error) {
    console.error(error);
    res.status(500).send({error:'Server Error.'});
  }
}

// TypeError: Do not know how to serialize a BigInt 해결코드
// 필수 코드인지는 별도 확인 필요
BigInt.prototype.toJSON = function() {       
  return this.toString()
}

//게시글 목록 조회 api
app.get('/post', async (req, res) => {
  try {
    const postList = await prisma.posts.findMany({
      select: {
        postId : true,
        title : true,
        publishDate : true,
        status : true
      }
    });
    res.send(postList)
  }
  catch(error){
    console.error(error);
    res.status(500).send({error: 'Server Error.'});
  }
});


//게시글 상세페이지 조회 API
app.get('/post/:id', async (req, res) => {
  try{
    const postId = Number(req.params.id)    

    const detail = await prisma.posts.findUnique({
      where: {
        postId : postId
      }
    });
    res.send(detail);
  }
  catch(error){
    console.error(error);
    res.status(500).send({error: 'Server Error.'});
  }
});

//게시글 수정 API
app.put('/post/:id', authenticateAccessToken, multer.single('file'), uploadImage, async(req, res) => {
  try {
    const postId = Number(req.params.id)
    const post = await prisma.posts.findUnique({
      where: {
        postId: postId
      }
    });
    const beforeImg = post.imagePath;

    // 게시글 수정
    prismaUpdate(postId, req, res);
    // 이미지 교체 OR 삭제
    if ((req.file == undefined) == (req.image == null)) {
        deleteFile(beforeImg);
    }
    res.send({message:'Updated Successfully.'})
  }
  catch(err) {
    console.error(err);
    res.status(500).send({error: 'Server Error.'});
  }
})

//게시글 삭제 API
app.delete('/post/:id', authenticateAccessToken, async(req, res) => {
  try {
    const postId = Number(req.params.id)
    const userId = req.user.id
    const postRes = await prisma.posts.findUnique({
      where:{
        postId: postId,
      }
    })
    
    if (postRes.userId == userId) { //게시글 작성자인지 확인 
      await prisma.posts.delete({
          where: {
              postId: postId,
          }
      });
      res.send({message: 'Deleted Successfully.'})
    }
    else {
      res.status(403).send({error: 'Authentication fail.'})
    }

  } catch (error) {
    console.error(error);
    res.status(500).send({error:'Server Error.'});
  }
});

///////////////////////////// 댓글 /////////////////////////////////

// 댓글 목록 조회 api (시간 순으로 오름차순 정렬하기)
app.get('/post/:id/comment', async (req, res) => {
  try {
      const postId = Number(req.params.id);
      
      const commentList = await prisma.comment.findMany({
          orderBy: [
              {
                  // commentDate 값이 일치하는 데이터들이 있을 수 있음. -> unique한 값을 갖고 생성순으로 ID값이 증가하는 PK로 정렬
                  commentId: 'asc',
              }
          ],
          where: {
              // postId가 일치하면 데이터 조회
              postId: postId
          },
          select: {
              userId: true,
              content: true,
              commentDate: true
          }
      });
      res.send(commentList);
  }
  catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Server Error.' });
  }
});


// 댓글 삭제 API
app.delete('/post/:id/comment/:commentId', authenticateAccessToken, async (req, res) => {
  try {
      const postId = Number(req.params.id);
      const commentId = Number(req.params.commentId);
      const userId = req.user.id;

      // commentId가 일치하는 댓글을 commentRes에 정보 저장
      const commentRes = await prisma.comment.findUnique({
          where: {
              commentId: commentId,
              postId: postId
          }
      })

      // commentRes에 저장된 userId와 현재 로그인 중인 user의 Id가 일치하는지 확인.
      if (commentRes.userId == userId) {
          await prisma.comment.delete({
              where: {
                  commentId: commentId
              }
          });
          res.send({ message: 'Deleted Successfully.' });
      }
      else {
          res.status(403).send({ error: 'Authentication fail.' });
      }

  } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Server Error.' });
  }
});


// 댓글 등록 API
app.post('/post/:id/comment', authenticateAccessToken, async (req, res) => {
  try {
      const postId = Number(req.params.id);
      const userId = req.user.id;
      const content = req.body.content;

      await prisma.comment.create({
          data: {
              postId: postId,
              userId: userId,
              content: content
          }
      })
      res.send({ message: 'Saved Successfully.' });
  } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Server Error.' });
  }
});


// 댓글 수정 API
app.put('/post/:id/comment/:commentId', authenticateAccessToken, async (req, res) => {
  try {
      const commentId = Number(req.params.commentId);
      const postId = Number(req.params.id);
      const userId = req.user.id;
      const content = req.body.content;

      const commentRes = await prisma.Comment.findUnique({
          where: {
              commentId: commentId,
              postId: postId
          },
      });

      if (commentRes.userId == userId) { //댓글 작성자인지 확인
          await prisma.Comment.update({
              where: {
                  commentId: commentId
              },
              data: {
                  content: content
              },
          });
          res.send({ message: 'Updated Successfully.' });
      } else {
          res.status(403).send({ error: 'Authentication fail.' });
      }
  } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Server Error.' });
  }
});
