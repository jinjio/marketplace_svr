import Debug from 'debug'
const debug = Debug('ankichampion:util:awsutil')
import assert from 'assert'

import jimp from 'jimp'
import dayjs from 'dayjs'

import { S3Client, PutObjectCommand, ListObjectsCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

const s3Client = new S3Client({
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_S3_KEY_ID,
    secretAccessKey: process.env.AWS_S3_ACCESS_KEY
  }
})

const textractClient = new TextractClient({
  region: "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_TEXTRACT_KEY_ID,
    secretAccessKey: process.env.AWS_TEXTRACT_ACCESS_KEY
  }
});

const bucket = 'chatomata'
// const bucket = 'ankichampion'
// 안키챔피언 버킷이 없는듯 해서 일단 챗토마타로 이용

function removeHost(url) {
  return url.replace(`https://${bucket}.s3-ap-northeast-2.amazonaws.com/`, "")
}
const s3Service = {
  uploadToS3: async function (file, location, height_limit) {
    let imageBuff = file.data
    // TODO 사이즈 줄이는게 작동을 안하는 듯함.
    let extension = file.name.split('.').pop()
    if (extension != 'svg') {
      if (height_limit != null) {
        try {
          let image = await jimp.read(file.data)
          if (image.bitmap.height > height_limit) {
            image.resize(jimp.AUTO, height_limit)
            imageBuff = await image.getBufferAsync(file.mimetype)
          }
        } catch (e) {
          debug('uploadToS3 error', e.message)
        }
      }
    }

    let params = {
      Bucket: bucket,
      region: "ap-northeast-2",
      ACL: "public-read",
      Body: imageBuff,
      ContentType: file.mimetype,
      Key: location
    }
    let uploadResult = await s3Client.send(new PutObjectCommand(params))

    debug('uploaded', `https://${params.Bucket}.s3-${params.region}.amazonaws.com/${location}`, uploadResult.ETag)
    return `https://${params.Bucket}.s3-${params.region}.amazonaws.com/${location}`
    // return uploadResult.Location
  },
  list: async function (url) {
    url = decodeURI(url)
    let location = removeHost(url)
    // location = location.substring(0, location.lastIndexOf('/'))
    let params = {
      Bucket: bucket,
      region: "ap-northeast-2",
      Prefix: location
    }
    let response = await s3Client.send(new ListObjectsCommand(params))
    debug(response)
    return response.Contents
  },
  deleteS3Single: async function (url) {
    url = decodeURI(url)
    let location = removeHost(url)
    let params = {
      Bucket: bucket,
      region: "ap-northeast-2",
      Key: location
    }
    let response = await s3Client.send(new DeleteObjectCommand(params))
    debug(response.httpStatusCode) // 204 No Content 는 삭제후 응답이다. https://velog.io/@server30sopt/204-NOCONTENT%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%84%EC%8B%9C%EB%82%98%EC%9A%94
    return response.httpStatusCode
  },
  deleteS3: async function (url) {
    url = decodeURI(url)
    let sub_list = await s3Service.list(url)
    if (sub_list?.length > 0) {
      sub_list = sub_list.sort((a, b) => b.Key.length - a.Key.length)
      for (let content of sub_list) {
        await s3Service.deleteS3Single(`${content.Key}`)
      }
      return sub_list.length
    } else {
      return await s3Service.deleteS3Single(url)
    }
  },

  recoverBlockImage: async function (url, form_id) {
    let filename = url.substring(url.lastIndexOf('/') + 1)
    let src_location = `trash/${filename}`
    let dest_location = `form/${form_id}/${filename}`
    let params = {
      CopySource: `hanform/${src_location}`,
      Bucket: "hanform",
      region: "ap-northeast-2",
      Key: dest_location,
    }
    let response = await s3Client.send(new CopyObjectCommand(params))
    await s3Service.deleteS3Single(src_location)
    return true
  },
  trashImage: async function (url) {
    url = decodeURI(url)
    let location = removeHost(url)
    let filename = url.substring(url.lastIndexOf('/') + 1)
    let dest_location = `trash/${filename}`
    let params = {
      CopySource: `${bucket}/${location}`,
      Bucket: bucket,
      Key: dest_location,
    }
    let response = await s3Client.send(new CopyObjectCommand(params))
    await s3Service.deleteS3Single(url)
    debug(response.httpStatusCode) // 204 No Content 는 삭제후 응답이다. https://velog.io/@server30sopt/204-NOCONTENT%EC%97%90-%EB%8C%80%ED%95%B4-%EC%95%84%EC%8B%9C%EB%82%98%EC%9A%94
    return response.httpStatusCode
  },

  cleanUpOldFiles: async function () {
    let list = await s3Service.list('trash/')
    for (let content of list) {
      // debug('content month', dayjs().diff(content.LastModified, 'month'))
      if (dayjs().diff(content.LastModified, 'month') >= 3) {
        let result = await s3Service.deleteS3Single(content.Key)
      }
    }
  },
  textract: async function (file) {
    const location = `textract/${file.name}`;
    await this.uploadToS3(file, location);

    const params = {
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: location
        }
      },
      FeatureTypes: ["TABLES", ]
    };

    try {
      const command = new AnalyzeDocumentCommand(params);
      const response = await textractClient.send(command);
      debug('Textract response', response);
      const englishWords = response.Blocks
      .filter(block => block.BlockType === 'WORD' && /^[a-zA-Z]+$/.test(block.Text) && block.Text.length <= 10)
      .map(block => block.Text);

      console.log('추출된 영어 단어:', englishWords);
      // Delete the file from S3 after processing
      // await this.deleteS3SingleS3(location);

      return response;
    } catch (error) {
      debug('Textract error', error.message);
      throw error;
    }
  }
}

export default s3Service

// s3Service.cleanUpOldFiles()