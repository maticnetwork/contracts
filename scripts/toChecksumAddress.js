// script to convert address to checksum EIP-55
// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-55.md

const createKeccakHash = require('keccak')

function toChecksumAddress(address) {
  address = address.toLowerCase().replace('0x', '')
  var hash = createKeccakHash('keccak256')
    .update(address)
    .digest('hex')
  var ret = '0x'

  for (var i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += address[i].toUpperCase()
    } else {
      ret += address[i]
    }
  }

  return ret
}
console.log(toChecksumAddress('7d1afa7b718fb893db30a3abc0cfc608aacfebb0'))
