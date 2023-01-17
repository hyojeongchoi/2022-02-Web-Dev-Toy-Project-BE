// GCP Storage
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket(process.env.GCP_STORAGE_BUCKET); // dotenv 필요

const { v4: uuidv4 } = require('uuid');


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
  next();
};

// GCP Storage 파일 삭제하는 함수 -> 삭제 딜레이 2-30분 있는지 확인하기
async function deleteFile(image) {
  if (image != null) {
    const fileNameWithPath = image.split(`https://storage.googleapis.com/${bucket.name}/`)[1];
    await storage.bucket(bucket.name).file(fileNameWithPath).delete();
    console.log(`gs://${bucket.name}/${fileNameWithPath} deleted`);
  }
}

// GCP image upload test API example
// app.post('/upload', multer.single('file'), (req, res, next) => {
//   if (!req.file) {
//     res.status(400).send('No file uploaded.');
//     return;
//   }
//   console.log(req.file)

//   const fileExtension = req.file.originalname.split('.').pop();
//   const fileName = uuidv4(); // uuid4
//   const filePath = `posts/test/${fileName}.${fileExtension}`;
//   const blob = bucket.file(filePath);
//   const blobStream = blob.createWriteStream({
//     resumable: false,
//   });

//   blobStream.on('error', err => {
//     next(err);
//   });

//   blobStream.on('finish', () => {
//     res.status(200).send(`https://storage.googleapis.com/${bucket.name}/` + filePath);
//   });

//   blobStream.end(req.file.buffer);
// });

module.exports = { uploadImage, deleteFile }