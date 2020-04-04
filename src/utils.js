const getJwk = () => {
  return JSON.parse(process.env.JWK)
}

const base64ToUint8 = (base64) => {
  const buf = Buffer.from(base64, 'base64')
  return new Uint8Array(buf)
}

module.exports = {
  getJwk,
  base64ToUint8,
}
