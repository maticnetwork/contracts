/* global artifacts */

const fs = require('fs')
//
// lib/utils
//
module.exports = async function(deployer, network) {
  let contracts = {
    SafeMath: artifacts.require(
      'openzeppelin-solidity/contracts/math/SafeMath.sol'
    ),
    Math: artifacts.require('openzeppelin-solidity/contracts/math/Math.sol'),
    ECVerify: artifacts.require('./lib/ECVerify.sol'),
    BytesLib: artifacts.require('./lib/BytesLib.sol'),
    RLP: artifacts.require('./lib/RLP.sol'),
    MerklePatriciaProof: artifacts.require('./lib/MerklePatriciaProof.sol'),
    Merkle: artifacts.require('./lib/Merkle.sol'),
    RLPEncode: artifacts.require('./lib/RLPEncode.sol'),
    Common: artifacts.require('./lib/Common.sol'),
    RootChain: artifacts.require('./RootChain.sol'),
    DepositManager: artifacts.require('./DepositManager.sol'),
    WithdrawManager: artifacts.require('./WithdrawManager.sol'),
    TestToken: artifacts.require('./token/TestToken.sol'),
    RootERC721: artifacts.require('./token/RootERC721.sol'),
    MaticWETH: artifacts.require('./token/MaticWETH.sol'),
    StakeManager: artifacts.require('./root/StakeManager.sol'),
    ExitNFT: artifacts.require('./token/ExitNFT.sol'),
    TxValidator: artifacts.require('./proofs/TxValidator.sol'),
    ERC20Validator: artifacts.require('./proofs/ERC20Validator.sol'),
    ExitValidator: artifacts.require('./proofs/ExitValidator.sol'),
    NonceValidator: artifacts.require('./proofs/NonceValidator.sol'),
    ERC721Validator: artifacts.require('./proofs/ERC721Validator.sol'),
    DepositValidator: artifacts.require('./proofs/DepositValidator.sol')
  }
  let addressData = {}
  const keys = Object.keys(contracts)
  for (let i = 0; i < keys.length; i++) {
    let c = await contracts[keys[i]].deployed()
    addressData[keys[i]] = c.address
    console.log(addressData[keys[i]], keys[i], c.address)
  }

  let data = JSON.stringify(addressData)
  console.log(data)
  fs.writeFileSync('contracts2.json', data)
}
