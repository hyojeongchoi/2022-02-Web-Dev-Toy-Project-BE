const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 닉네임 중복확인 함수
async function nicknameOverlapCheck(nickname) {
  const result = await prisma.users.findFirst({
    where: {
      nickname: nickname,
    },
    select: {
      nickname: true,
    },
  });

  // result === null가 true이면 사용 가능, false면 사용 불가
  return result === null;
}

module.exports = { nicknameOverlapCheck };
