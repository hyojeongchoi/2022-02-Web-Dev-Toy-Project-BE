const express = require('express');
const app = express();
app.use(express.json());

// env
const dotenv = require("dotenv");
dotenv.config();

// redis
const redisClient = require('./redis/Redis');
redisClient.connect();

const Auth = require('./routes/Auth');
const Post = require('./routes/Post');
const Comment = require('./routes/Comment');
const Alarm = require('./routes/Alarm');

app.use("/auth/user", Auth);
app.use("/post", Post);
app.use("/:id/comment", Comment);
app.use("/alarm", Alarm);

const PORT = 8081;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});