const express = require("express");
const app = express();
app.use(express.json());

// env
const dotenv = require("dotenv");
dotenv.config();

// redis
const redisClient = require("./redis/Redis");
redisClient.connect();

const Auth = require("./routes/Auth");
const Post = require("./routes/Post");
const Comment = require("./routes/Comment");
const Alarm = require("./routes/Alarm");
const Mypage = require("./routes/Mypage");
const CommentAlarm = require("./routes/CommentAlarm");

// CORS ERROR
app.all("/*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, UPDATE");
  res.header("SameSite", "None");
  next();
});

app.use("/auth/user", Auth);
app.use("/post", Post);
app.use("/comment", Comment);
app.use("/alarm", Alarm);
app.use("/mypage", Mypage);
app.use("/comment/alarm", CommentAlarm)

const PORT = 8081;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
