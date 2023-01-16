const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const { uploadImage, deleteFile } = require('../util/Storage');

const { authenticateAccessToken } = require('../middlewares/Auth');
const multer = require('../middlewares/Multer');


// 게시글 작성 api
router.post('/', authenticateAccessToken, multer.single('file'), uploadImage, async (req, res) => {
  try{
    const json = JSON.parse(req.body.json);

    const userId = Number(req.user.id)
    const title = json.title
    const content = json.content
    const image = req.image
    // const publishDate = req.body.publishDate // BE에서 처리해야 함
    const place = json.place
    const status = json.status

    await prisma.posts.create({
      data:{
        userId: userId,
        title : title, 
        content : content, 
        imagePath : image, 
        // publishDate : publishDate,
        place : place,
        status : status
      },
    })
    res.send({message:'Saved Successfully.'})
  } catch (error) {
    console.error(error);
    res.status(500).send({error: 'Server Error.'});
  }
});

// TypeError: Do not know how to serialize a BigInt 해결코드
// 필수 코드인지는 별도 확인 필요
BigInt.prototype.toJSON = function() {       
  return this.toString()
}

// 게시글 목록 조회 api
router.get('/', async (req, res) => {
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


// 게시글 상세페이지 조회 API
router.get('/:id', async (req, res) => {
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

// 게시글 수정 API
router.put('/:id', authenticateAccessToken, multer.single('file'), uploadImage, async(req, res) => {
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

// 게시글 삭제 API
router.delete('/:id', authenticateAccessToken, async(req, res) => {
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

// 게시글 업데이트 함수
async function prismaUpdate(postId, req, res){
  const json = JSON.parse(req.body.json);
  if (req.image == undefined) {
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
      res.send({ message: 'Updated Successfully.' })
    }
    else {
      res.status(403).send({ error: 'Authentication fail.' })
    }

  } catch (error) {
    console.error(error);
    res.status(500).send({ error:'Server Error.' });
  }
}

module.exports = router;