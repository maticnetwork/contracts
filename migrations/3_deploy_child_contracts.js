const fs = require('fs')

const SafeMath = artifacts.require(
  'openzeppelin-solidity/contracts/math/SafeMath.sol'
)

const ChildChain = artifacts.require('ChildChain')
const ECVerify = artifacts.require('ECVerify')

module.exports = async function(deployer, network, accounts) {
  deployer.then(async() => {
    console.log(`network: ${network}`)
    await deployer.deploy(SafeMath)
    await deployer.link(SafeMath, ChildChain)

    await deployer.deploy(ECVerify)
    await deployer.link(ECVerify, ChildChain)

    await deployer.deploy(ChildChain)

    // let contractAddresses = fs.readFileSync(`${process.cwd()}/contractAddresses.json`).toString()
    // contractAddresses = JSON.parse(contractAddresses)

    // const childChain = await ChildChain.deployed()

    // // add matic WETH
    // let p = await childChain.addToken(
    //   accounts[0],
    //   contractAddresses.MaticWETH,
    //   // '0x421dc9053cb4b51a7ec07b60c2bbb3ec3cfe050b', // - this is the testnetv2 MaticWETH address
    //   'Matic WETH',
    //   'MTX',
    //   18,
    //   false // _isERC721
    // )
    // let evt = p.logs.find(log => {
    //   return log.event === 'NewToken'
    // })
    // contractAddresses['ChildWeth'] = evt.args.token

    // // add root token
    // p = await childChain.addToken(
    //   accounts[0],
    //   contractAddresses.RootToken,
    //   // '0x6b0b0e265321e788af11b6f1235012ae7b5a6808', // - this is the testnetv2 TestToken address
    //   'Token S',
    //   'STX',
    //   18,
    //   false // _isERC721
    // )
    // evt = p.logs.find(log => {
    //   return log.event === 'NewToken'
    // })
    // contractAddresses['ChildToken'] = evt.args.token

    // fs.writeFileSync(
    //   `${process.cwd()}/contractAddresses.json`,
    //   JSON.stringify(contractAddresses, null, 4) // Indent 4 spaces
    // )
  })
}
