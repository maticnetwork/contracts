/* global artifacts */

const contracts = require('./contracts.json')

const ChildChain = artifacts.require('./child/ChildChain.sol')
const StakeManager = artifacts.require('./root/StakeManager.sol')
// const RootToken = artifacts.require('./token/TestToken.sol')

module.exports = function(deployer) {
  console.log(deployer)
  async function stake(deployer) {
    console.log('----')
    const childChain = await deployer.deploy(ChildChain)
    let out = await childChain.addToken(
      '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      contracts.TestToken,
      'test token',
      'TEST',
      18,
      false
    )
    console.log(out)
    out = await childChain.addToken(
      '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      contracts.MaticWETH,
      'Matic Weth',
      'MWETH',
      18,
      false
    )
    console.log(out)
    out = await childChain.addToken(
      '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      contracts.RootERC721,
      'test ERC721',
      'TESTERC721',
      1,
      true
    )
    console.log(out)
  }
  stake(deployer)
}
