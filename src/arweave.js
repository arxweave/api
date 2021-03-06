const fs = require('fs')
const axios = require('axios')
const { getJwk, base64ToUint8 } = require('./utils')

const jwk = getJwk()

const arweave = require('arweave/node').init({
  host: 'arweave.net', // Hostname or IP address for a Arweave host
  port: 443, // Port
  protocol: 'https', // Network protocol http or https
  timeout: 20000, // Network request timeouts in milliseconds
  logging: false, // Enable network request logging
})

function ArweaveService() {
  /*
    Create a transaction object with data and optional tags.
    Return a signed tx object that is ready to be broadcasted.
    data: text/html
    tags: [ {k: v} ]
  */
  const createDataTx = async ({ data, tags = {}, reward = '12064776' }) => {
    // ! default winston value 12064776 which is equivalent to 0.000012064776 ar
    try {
      // Create a new tx instance
      const tx = await arweave.createTransaction(
        {
          data,
          reward,
        },
        jwk
      )

      // This is really ugly but setting it during createTransaction fails.
      Object.entries(tags).forEach(([k, v]) => tx.addTag(k, v))

      // Sign the tx. Strangely the sign has no return value.
      await arweave.transactions.sign(tx, jwk)
      return tx
    } catch (err) {
      console.error('[ArweaveService]: ', err)
      return new Error(err)
    }
  }

  const createPDFTx = async ({ data, tags = [] }) => {
    if (!data) throw new Error('[ArweaveService]: data must exist')
    const uInt8 = base64ToUint8(data)
    try {
      const txPrice = await axios
        .get(`https://arweave.net/price/${uInt8.byteLength}`)
        .then((res) => res.data)

      return createDataTx({
        data: uInt8,
        tags: { ...tags, 'Content-Type': 'application/pdf' },
        reward: txPrice.toString(),
      })
    } catch (err) {
      console.error('Failed to get price', err)
      return new Error(err)
    }
  }

  const broadcastTx = async ({ tx }) => {
    try {
      const res = await arweave.transactions.post(tx).catch((res) => {
        throw new Error(res.data)
      })

      return {
        status: res.status,
        data: res.data,
        id: tx.id,
      }
    } catch (err) {
      console.error('Broadcast:'.err)
      return new Error(err)
    }
  }

  const watchTx = async (id) => {
    if (!id) return new Error('WatchTx requires and id')
    return await arweave.transactions.getStatus(id)
  }

  /*
    Convert the values of a transaction into human readable form.
    More importantly return link to data on arweave.net.
  */
  const getTx = async (txId) => {
    try {
      const tx = await arweave.transactions.get(txId)
      return {
        ...tx,
        data: '',
        // data: tx.get('data', { decode: true, string: true }),
        tags: tx.get('tags').map((tag) => {
          let key = tag.get('name', { decode: true, string: true })
          let value = tag.get('value', { decode: true, string: true })
          return `${key} : ${value}`
        }),
        url: `https://arweave.net/tx/${tx.id}/data.html`,
      }
    } catch (err) {
      return new Error(err)
    }
  }

  /*
    Arweave seems to have a single address per key, and requires you
    to derive it each time.
  */
  const address = () => arweave.wallets.jwkToAddress(jwk)

  /*
    Since we already know the address, we can return the balance.
    Set default return value to 'ar'
  */
  const balance = async () => {
    const address = await address()
    const b = await arweave.wallets.getBalance(address)
    return arweave.ar.winstonToAr(b)
  }

  return {
    createDataTx,
    createPDFTx,
    broadcastTx,
    watchTx,
    getTx,
    address,
    balance,
  }
}

/*
  Example how to use service to take a string, with a content/type of html and
  retrieve an url to the permadata https://arweave.net/tx/${tx.id}/data.html
  Changing the `reward` by a multiple (x2 or x10) of the default value does not reduce
  the processing time of the tx. On last run the tx processing time was ~ 4.5min
*/

async function main() {
  const s = ArweaveService()
  const data =
    '<html><head><meta charset="UTF-8"></head><body><h1>Faster!</h1></body></html>'
  const tags = [{ 'Content-Type': 'text/html' }, { CustomTag: 'super-dodge' }]
  try {
    const rawTx = await s.createDataTx({ data, tags })
    console.log('Tx Ready', rawTx.id)
    const broadcastedTx = await s.broadcastTx({ tx: rawTx })
    console.log('Tx Broadcasted', broadcastedTx)

    // 200: broadcasted
    // 208: transaction already processed
    if (broadcastedTx.status === 200 || broadcastedTx.status === 208) {
      let stop = false
      const timerName = 'Tx processing time'
      console.time(timerName)
      while (!stop) {
        const confirmedTx = await s.watchTx(broadcastedTx.id)
        console.log('Watching', broadcastedTx.id, confirmedTx)
        // 202: Pending
        if (confirmedTx.status === 200) {
          console.log('Confirmed!')
          stop = true
        }
      }
      console.timeEnd(timerName)

      const finalTx = await s.getTx(rawTx.id)
      console.log('Final:', finalTx)
      return finalTx
    }

    throw new Error('Main failed')
  } catch (err) {
    console.error(err)
  }
}

// main() // NOTE: decomment for tests.

module.exports = ArweaveService
