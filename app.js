const express = require('express')
const cors = require('cors')
const AWS = require('aws-sdk')
const axios = require('axios')
const parser = require('fast-xml-parser')
const pdf2base64 = require('pdf-to-base64')
const ArweaveService = require('./arweave.js')()


AWS.config.update({
  region: "eu-central-1",
})
AWS.config.logger = console;

const dynamoDB = new AWS.DynamoDB({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})
const docClient = new AWS.DynamoDB.DocumentClient({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

// Setup a white list for CORS
const whilelist = [
  process.env.APP_DOMAIN,
  'https://sw4rtz.it',
  'https://wwww.sw4rtz.it',
  'https://sw4rtz.netlify.com',
  'https://localhost:3000',
  'http://localhost:3000',
  'https://localhost:8000',
  'http://localhost:8000'
].filter(Boolean);

const isValidReferrrer = (r) => whilelist.filter(w => r.includes(w))

// CORS config adapted from
// https://dustinpfister.github.io/2018/01/28/heroku-cors/
const conf = {
  // Our frontend uses a webnpack proxy to call the dev api. When doing so the request is sent from the
  // front projects domain (localhost) and the browser considers the request as 'same-origin' so it
  // doesn't add the 'origin' header. At this point our api receives a request with 'origin' undefined.
  originUndefined: function (req, res, next) {
    if (!req.headers.origin && req.headers.referer && !isValidReferrrer(req.headers.referer)) {
      res.json({
        msg: 'Hi you are visiting the service locally. If this was a CORS the origin header should not be undefined'
      });
    } else {
      next();
    }
  },
  // Cross Origin Resource Sharing Options
  cors: {
    // origin handler
    origin: function (origin, cb) {
      // The origin header is set by the browser.
      if (!origin || whilelist.indexOf(origin) != -1) {
        cb(null, true);
      } else {
        cb(new Error('invalid origin: ' + origin), false);
      }
    },
    optionsSuccessStatus: 200
  }
}

const app = express()

app.use(express.urlencoded({ extended: true }))
app.use(conf.originUndefined, cors(conf.cors))
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.options('/new', cors(conf.cors))
app.use(express.json())

// Get all arXiv documents
// TODO: add pagination.
app.get('/all', (request, response) => {
  const params = {
    TableName: 'Arxweave',
    ProjectionExpression: 'arXivID, arXivURL, authors, broadcastedTxID, pdfLink, published, summary, title, statusArweave'
  }

  // FIXME: show errors to console.log() .
  docClient.scan(params, (err, data) => response.send(data !== null ? data.Items : `{msg: 'There is not any item.'}`)) // NOTE: 1MB limit.
  // docClient.scan(params, (err, data) => console.log(err)) // NOTE: 1MB limit.
})

// Get single arXiv document
app.get('/arXivID/:arXivID', (request, response) => {
  const arXivID = request.params.arXivID

  const params = {
    TableName: 'Arxweave',
    Key: {
      'arXivID': {S: arXivID}
    }
  }

  dynamoDB.getItem(params, async (err, data) => {
    if (err)
      console.log('Error', err)
    else {
      // If object does not exists, add it in dynamoDB and Arweave.
      if(Object.keys(data).length === 0) {
        response.send({
          status: 'Bad Request',
          msg: `This arXiv entry does not exist in Arxweave.`}
        )
      } else response.send(data)
    }
  })
})

// app.get('/exists/:arXvID', async (request, response) => {
//   const arXivID = request.params.arXivID

//   const params = {
//     TableName: 'Arxweave',
//     Key: {
//       'arXivID': { S: arXivID }
//     }
//   }

//   dynamoDB.getItem(params, async (err, data) => {
//     if (err) {
//       console.log('Error', err)
//     } else if (Object.keys(data).length !== 0) {
//       response.send({
//         arXivID: params.Key.arXivID,
//         exists: true
//       })
//     } else {
//       response.send({
//         arXivID: params.Key.arXivID,
//         exists: false
//       })
//     }
//   })
// })

app.post('/new', cors(conf.cors), async (request, response) => {
  const arXivID = request.body.arXivID

  const params = {
    TableName: 'Arxweave',
    Key: {
      'arXivID': {S: arXivID}
    }
  }

  dynamoDB.getItem(params, async (err, data) => {
    if (err)
      console.log('Error', err)
    else {
      // If object does not exists, add it in dynamoDB and Arweave.
      if(Object.keys(data).length === 0) {
        try {
          const responseArxiv = await axios.get(`https://export.arxiv.org/api/query?id_list=${arXivID}`)
          const entry = parser.convertToJson(parser.getTraversalObj(responseArxiv.data, {}), {}).feed.entry

          const arXivPdfBase64 = await pdf2base64(entry.id.replace('abs', 'pdf'))

          const arweaveTxPrice = await axios.get(`https://arweave.net/price/${Buffer.byteLength(arXivPdfBase64, 'utf8')}`)

          const rawTx = await ArweaveService.createDataTx({
            data: arXivPdfBase64,
            reward: `${arweaveTxPrice.data}`,
            tags: [{
              'Encode': 'base64',
              'Content-Type': 'application/pdf',
              'arXivID': arXivID,
              'authors': JSON.stringify(entry.author),
              'updated': entry.updated,
              'published': entry.published,
              'title': entry.title,
              'summary': entry.summary,
              'pdfLink': entry.id.replace("abs", "pdf")
            }]
          })

          const broadcastedTx = await ArweaveService.broadcastTx({ tx: rawTx })

          if (broadcastedTx.id)
            await dynamoDB.putItem({
              TableName: 'Arxweave',
              Item: {
                'arXivID': {S: arXivID},
                'authors': {S: JSON.stringify(entry.author)},
                'updated': {S: entry.updated},
                'published': {S: entry.published},
                'title': {S: entry.title},
                'summary': {S: entry.summary},
                'pdfLink': {S: entry.id.replace("abs", "pdf")},
                'broadcastedTxID': {S: broadcastedTx.id},
                'statusArweave': {S: `${broadcastedTx.status}`} // NOTE: status attribute is a dynamo name reserved.
              }
            }, (err, data) => {
              if (err)
                console.log('Error', err)
              else
                console.log('Success', data)
            })

          response.send({
            status: broadcastedTx.status === 200 ? 'Success' : 'Error',
            msg: `Data is uploading to arweave with this broadcast ID ${broadcastedTx.id} and Arweave status ${broadcastedTx.status}.`,
            txId: `${broadcastedTx.id}`,
            txStatus: `${broadcastedTx.status}`
          })
        } catch (error) {
          console.error(error)
        }
      } else response.send({
        status: 'Bad Request',
        msg: `This arXiv entry is already uploaded.`}
      )
    }
  })
})

let port = process.env.PORT;
if (port == null || port == "") {
  port = 8000;
}
app.listen(port, () => {
  console.log(`It's working!`)
});
