const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { authenticateAccessToken } = require('../middlewares/Auth');


//댓글 알림 OFF 기능
router.post('/:id/off', authenticateAccessToken, async(req, res) => {
    try {
        const userId = Number(req.user.id)
        const postId = Number(req.params.id)

        await prisma.comment_alarmoff.create({
            data: {
                userId: userId,
                postId: postId
            }
        })

        await prisma.comment_alarm.deleteMany({ //comment_alarm 테이블에서 해당하는 알람 삭제
            where:{
                AND:[
                    {userId: userId},
                    {postId: postId}
                ]
            }
        })
        res.send({ message: 'Saved Successfully.'})
        
    } catch(error) {
        console.error(error)
        res.status(500).send({ error: 'Server Error.'})
    }
})

//댓글 알림 On 기능
router.post('/:id/on', authenticateAccessToken, async(req, res) => {
    try {
        const userId = Number(req.user.id)
        const postId = Number(req.params.id)

        await prisma.comment_alarmoff.deleteMany({ //comment_alarm 테이블에서 해당하는 알람 삭제
            where:{
                AND:[
                    {userId: userId},
                    {postId: postId}
                ]
            }
        })
        res.send({ message: 'Deleted Successfully.'})
        
    } catch(error) {
        console.error(error)
        res.status(500).send({ error: 'Server Error.'})
    }
})

//댓글 알림 기능
router.get('/', authenticateAccessToken, async(req, res) => {
    try {
        const userId = Number(req.user.id)
    const alarmOffPostList = await prisma.comment_alarmoff.findMany({ //댓글 알림Off한 게시글
        select: {
            postId: true
        },
        where: {
            userId: userId
        }
    })

    const postList = await prisma.posts.findMany({ //내가 쓴 글
        select: {
            postId: true
        },
        where: {
            userId: userId
        }
    })

    const commentPostList = await prisma.comment.findMany({ //내가 댓글단 글
        select: {
            postId: true
        },
        where: {
            userId: userId
        }
    })

    var merged = postList.concat(commentPostList) //내가 쓴 글 + 댓글 단 글(중복O)
    
    var newArray = [];
    for(i = 0; i < merged.length; i++) { //내가 쓴 글 + 댓글 단 글(중복X)
        if(!newArray.includes(merged[i].postId))
        newArray.push(merged[i].postId)
    }

    let filtered = newArray
    for(i = 0; i < alarmOffPostList.length; i++){ //내가 쓴 글 + 댓글 단 글(중복X)에서 알람 Off한 글 제거
        filtered = filtered.filter((element) => element !== alarmOffPostList[i].postId)
    }

    //comment 테이블에서 filter된 postId에 해당하는 comment 선택
    var finalCommentList = [];
    for(i = 0; i < filtered.length; i++) {
        const commentList = await prisma.comment.findMany({
            select: {
                commentId: true,
                content: true,
                postId: true
            },
            where: {
                AND: [
                    {postId: filtered[i]}
                ],
                NOT: [
                    {userId: userId} //본인이 쓴 댓글은 제외
                ]
            }
        })
        for(j = 0; j < commentList.length; j++){ //finalCommentList배열에 추가
            finalCommentList.push(commentList[j])
        }
    }

    //comment_alarm 테이블에 입력
    for(i = 0; i < finalCommentList.length; i++){
        await prisma.comment_alarm.upsert({
            where: {
                uniqueId: String(userId)+','+String(finalCommentList[i].commentId)
            },
            update: {},
            create: {
                userId: userId,
                commentId: finalCommentList[i].commentId,
                postId: finalCommentList[i].postId,
                uniqueId: String(userId)+','+String(finalCommentList[i].commentId),
                content: finalCommentList[i].content,
                readStatus: '안읽음'
            }
        })
    }
    
    //comment_alarm 테이블에서 사용자에 따라 출력
    const alarmList = await prisma.comment_alarm.findMany({
        where: {
            userId: userId
        },
        select: {
            cAlarmId: true,
            content: true,
            readStatus: true
        },
        orderBy: {
            commentId: 'desc' //댓글 최신 작성순
        }
    })
    res.send(alarmList);
    } catch(error) {
        console.error(error);
        res.status(500).send({ error: 'Server Error.' });
    }
})

//댓글 알림 읽음처리 API
router.post('/:id/status', authenticateAccessToken, async (req, res) => {
    try {
        const alarmId = Number(req.params.id);

        await prisma.comment_alarm.update({
            where: {
                cAlarmId: alarmId,
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

module.exports = router;