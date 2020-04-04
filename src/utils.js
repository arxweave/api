const getJwk = () => {
  return {
    ...JSON.parse(process.env.JWK),
    n: process.env.JWK_N,
    d: process.env.JWK_D,
    p: process.env.JWK_P,
    q: process.env.JWK_Q,
    dp: process.env.JWK_DP,
    dq: process.env.JWK_DQ,
    qi: process.env.JWK_QI,
  }
}

const base64ToUint8 = (base64) => {
  const buf = Buffer.from(base64, 'base64')
  return new Uint8Array(buf)
}

module.exports = {
  getJwk,
  base64ToUint8,
}
