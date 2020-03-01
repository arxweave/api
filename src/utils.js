const getJwk = () => {
  return {
    kty: 'RSA',
    ext: true,
    e: process.env.JWK_KEY,
    n: process.env.JWK_SECRET,
  }
}

module.exports = {
  getJwk
}
