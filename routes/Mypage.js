const express = require("express");
const app = express();

const { authenticateAccessToken } = require("../middlewares/Auth");

// [마이페이지] 게시글 조회 (최근 작성 순)
app.get("/post", authenticateAccessToken, async (req, res) => {
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
app.get("/comment", authenticateAccessToken, async (req, res) => {
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
app.put("/nickname", authenticateAccessToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const newNickname = req.body.newNickname;

    // 유효성 검사
    if (!isValid(newNickname)) {
      res.status(400).send({ error: "Invalid Input" });
      throw new Error("Invalid Input");
    }

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
    res.status(500).send({ errer: "Server Error." });
  }
});

// 닉네임 유효성 검사 (공백, 길이)
function isValid(newNickname) {
  // 공백 검사
  const blank_pattern = /^\s+|\s+$/g;
  if (newNickname.replace(blank_pattern, "") == "") {
    return false;
  }

  // 길이 검사 (3 초과, 10 이하)
  if (!newNickname || newNickname.length < 3 || newNickname.length > 10) {
    return false;
  }

  return true;
}
