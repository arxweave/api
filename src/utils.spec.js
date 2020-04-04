const { StringDecoder } = require('string_decoder')
const { base64ToUint8 } = require('./utils')

const testStr = 'Tm8gdG8gUmFjaXNt' // "No to Racism"

test('base64ToUint8', () => {
  const decoder = new StringDecoder('utf-8')
  const uint8array = base64ToUint8(testStr)
  const value = decoder.end(uint8array)
  expect(value).toEqual('No to Racism')
})
