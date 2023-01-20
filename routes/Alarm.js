const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { authenticateAccessToken } = require('../middlewares/Auth');

//TypeError: Do not know how to serialize a BigInt 해결코드
BigInt.prototype.toJSON = function () {
    return this.toString()
}

// Users 테이블에 알림 설정 정보 저장
router.post('/setting', authenticateAccessToken, async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const place = req.body.place;   //배열 자료형으로 받아온 place와 tag
        const tag = req.body.tag;

        await prisma.users.update({
            where: {
                userId: userId
            },
            data: {
                place: JSON.stringify(place),
                tag: JSON.stringify(tag)    //place와 tag를 JSON클래스를 이용해 배열 문자열로 저장
            }
        })
        res.send({ message: 'Saved Successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Server Error.' });
    }
});


// 조건에 맞는 최신 10개 게시글 alarm 테이블에 입력
router.get('/insert', authenticateAccessToken, async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const user = await prisma.users.findUnique({
            where: {
                userId: userId
            }
        });

        const placeArr = JSON.parse(user.place);    //배열 자료형으로 변환
        const tagArr = JSON.parse(user.tag);  // ''

        //posts 테이블에서 placeList 값 또는 tagList 값이 속하는 것 10개
        const postList = await prisma.posts.findMany({
            select: {
                postId: true,
                place: true,
                tag: true,
                title: true,
                status: true
            },
            where: {
                OR: [
                    { place: { in: placeArr } },
                    { tag: { in: tagArr } }
                ],
                AND: [
                    { postStatus: 'found' } // 분실물 '발견'. (분실물 신고 '요청' x)
                ]
            },
            orderBy: {
                postId: 'desc'
            },
            take: 10
        });

        //alarm 테이블에 데이터 입력
        for (i = 0; i < postList.length; i++) {
            await prisma.alarm.create({
                data: {
                    userId: userId,
                    postId: postList[i].postId,
                    title: postList[i].title,
                    place: postList[i].place,
                    tag: postList[i].tag,
                    status: postList[i].status,
                    readStatus: '안읽음'
                }
            });
        };
        res.send({ message: 'Saved Successfully.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Server Error.' });
    }
})


//게시물 읽음처리 API
router.post('/:id/status', authenticateAccessToken, async (req, res) => {
    try {
        // 알람을 읽었는지 확인하는 것이기에, 알림id를 받아오는 것으로 수정
        // + prisma update를 쓰려면 unique한 칼럼으로 조회해야함
        //const userId = Number(req.user.id);
        const alarmId = Number(req.params.id);

        await prisma.alarm.update({
            where: {
                //userId: userId,
                alarmId: alarmId
            },
            data: {
                readStatus: '읽음'
            }
        });
        res.send({ message: 'Updated Successfully.' });
    } catch (error) {
        console.error(error)
        res.status(500).send({ error: 'Server Error.' });
    }
})


//alarm 테이블에서 사용자에 따라 출력
router.get('/', authenticateAccessToken, async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const alarmList = await prisma.alarm.findMany({
            where: {
                userId: userId
            },
            select: {
                postId: true,
                title: true,
                place: true,
                tag: true,
                readStatus: true
            },
            orderBy: {
                postId: 'desc'
            },
            take: 10
        });
        res.send(alarmList);
    }
    catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Server Error.' });
    }
});

module.exports = router;