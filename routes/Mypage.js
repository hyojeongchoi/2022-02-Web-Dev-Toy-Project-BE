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
