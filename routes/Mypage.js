const express = require("express");
const router = express.Router();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { authenticateAccessToken } = require("../middlewares/Auth");
const { nicknameOverlapCheck } = require("../util/NicknameCheck");

const invalidErr = new Error("Invalid Input");

//TypeError: Do not know how to serialize a BigInt 해결코드
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// [마이페이지] 게시글 조회 (최근 작성 순)
router.get("/post", authenticateAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postList = await prisma.posts.findMany({
      orderBy: [
        {
          publishDate: "desc",
        },
      ],
      where: {
        userId: userId,
      },
      select: {
        postId: true,
        title: true,
        publishDate: true,
        status: true,
      },
    });
    res.send(postList);
  } catch (err) {
    console.error(err);
    res.status(500).send({ errer: "Server Error." });
  }
});

// [마이페이지] 댓글 조회 (최근 작성 순)
router.get("/comment", authenticateAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentList = await prisma.comment.findMany({
      orderBy: [
        {
          commentDate: "desc",
        },
      ],
      where: {
        userId: userId,
      },
      select: {
        userId: true,
        content: true,
        commentDate: true,
        post: true,
      },
    });
    res.send(commentList);
  } catch (err) {
    console.error(err);
    res.status(500).send({ errer: "Server Error." });
  }
});

// [마이페이지] 닉네임 수정
router.put("/nickname", authenticateAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const newNickname = req.body.newNickname;

    // 유효성 검사
    isValid(newNickname).then((res) => {
      if (!res) {
        throw invalidErr;
      }
    });

    // DB 업데이트
    await prisma.users.update({
      where: {
        userId: userId,
      },
      data: {
        nickname: newNickname,
      },
    });

    // 닉네임 수정 결과
    const result = await prisma.users.findUnique({
      where: {
        userId: userId,
      },
      select: {
        nickname: true,
      },
    });

    res.send({
      data: result,
      message: "Changed Successfully.",
    });
  } catch (err) {
    console.error(err);

    if (err === invalidErr) {
      res.status(400).send({ error: "Invalid Input" });
    } else {
      res.status(500).send({ errer: "Server Error." });
    }
  }
});

// 닉네임 유효성 검사 (공백, 길이)
async function isValid(newNickname) {
  // 공백 검사
  const blank_pattern = /^\s+|\s+$/g;
  if (newNickname.replace(blank_pattern, "") == "") {
    return false;
  }

  // 길이 검사 (2 이상, 10 이하)
  if (!newNickname || newNickname.length < 2 || newNickname.length > 10) {
    return false;
  }

  // 중복 확인 검사
  return await nicknameOverlapCheck(newNickname);
}

module.exports = router;
