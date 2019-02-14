/* global artifacts */

const contracts = require('./contracts.json')
//
// Main contracts
//
const RootChain = artifacts.require('./RootChain.sol')
const DepositManager = artifacts.require('./DepositManager.sol')
const WithdrawManager = artifacts.require('./WithdrawManager.sol')
const RootToken = artifacts.require('./token/TestToken.sol')
const StakeManager = artifacts.require('./root/StakeManager.sol')
const ExitNFT = artifacts.require('./token/ExitNFT.sol')
const MaticWETH = artifacts.require('./token/MaticWETH.sol')

//
// proofscontracts/proofs
//
const TxValidator = artifacts.require('./proofs/TxValidator.sol')
const ERC20Validator = artifacts.require('./proofs/ERC20Validator.sol')
const ExitValidator = artifacts.require('./proofs/ExitValidator.sol')
const NonceValidator = artifacts.require('./proofs/NonceValidator.sol')
const ERC721Validator = artifacts.require('./proofs/ERC721Validator.sol')
const DepositValidator = artifacts.require('./proofs/DepositValidator.sol')

// module.exports = async function(deployer, network) {
//   console.log(`${network} : network`)
//   // deployer.then(async() => {

// }

module.exports = function() {
  async function mapTokens() {
    console.log('---')
    const depositManager = await DepositManager.at(contracts.DepositManager)
    // console.log(depositManager)
    const withdrawManager = await WithdrawManager.at(contracts.WithdrawManager)
    const stakeManager = await StakeManager.at(contracts.StakeManager)
    const rootChain = await RootChain.at(contracts.RootChain)
    const exitNFT = await ExitNFT.at(contracts.ExitNFT)
    const txValidator = await TxValidator.at(contracts.TxValidator)
    const _ERC20Validator = await ERC20Validator.at(contracts.ERC20Validator)
    const exitValidator = await ExitValidator.at(contracts.ExitValidator)
    const nonceValidator = await NonceValidator.at(contracts.NonceValidator)
    const _ERC721Validator = await ERC721Validator.at(contracts.ERC20Validator)
    const depositValidator = await DepositValidator.at(contracts.DepositManager)

    // set rootchain
    console.log('change exitNFT rootchain')
    await exitNFT.changeRootChain(contracts.RootChain)
    console.log('change stakeManager rootchain')
    await stakeManager.changeRootChain(contracts.RootChain)
    console.log('change depositManager rootchain')
    await depositManager.changeRootChain(contracts.RootChain)
    console.log('change withdrawManager rootchain')
    await withdrawManager.changeRootChain(contracts.RootChain)
    console.log('change txValidator rootchain')
    await txValidator.changeRootChain(contracts.RootChain)
    console.log('change _ERC20Validator rootchain')
    await _ERC20Validator.changeRootChain(contracts.RootChain)
    console.log('change exitValidator rootchain')
    await exitValidator.changeRootChain(contracts.RootChain)
    console.log('change nonceValidator rootchain')
    await nonceValidator.changeRootChain(contracts.RootChain)
    console.log('change _ERC721Validator rootchain')
    await _ERC721Validator.changeRootChain(contracts.RootChain)
    console.log('change depositValidator rootchain')
    await depositValidator.changeRootChain(contracts.RootChain)

    console.log('set deposit withdraw contracts :6 TX')
    console.log('Root chain setChildContract')
    await rootChain.setChildContract(contracts.ChildChain)
    console.log('Root chain setStakeManager')
    await rootChain.setStakeManager(contracts.StakeManager)
    console.log('Root chain setDepositManager')
    await rootChain.setDepositManager(contracts.DepositManager)
    console.log('Root chain setWithdrawManager')
    await rootChain.setWithdrawManager(contracts.WithdrawManager)
    console.log('Root chain setExitNFTContract')
    await rootChain.setExitNFTContract(contracts.ExitNFT)
    console.log('Root chain setWETHToken')
    await rootChain.setWETHToken(contracts.MaticWETH)

    console.log('change rootchain :6 TX')
    await rootChain.addProofValidator(contracts.TxValidator)
    await rootChain.addProofValidator(contracts.ERC20Validator)
    await rootChain.addProofValidator(contracts.ExitValidator)
    await rootChain.addProofValidator(contracts.NonceValidator)
    await rootChain.addProofValidator(contracts.ERC721Validator)
    await rootChain.addProofValidator(contracts.DepositValidator)
    console.log('done')
  }
  mapTokens()
}
// await txValidator.setDepositManager(depositManager.address)
// await _ERC20Validator.setDepositManager(depositManager.address)
// await exitValidator.setDepositManager(depositManager.address)
// await nonceValidator.setDepositManager(depositManager.address)
// await _ERC721Validator.setDepositManager(depositManager.address)
// await depositValidator.setDepositManager(depositManager.address)

// await txValidator.setWithdrawManager(withdrawManager.address)
// await _ERC20Validator.setWithdrawManager(withdrawManager.address)
// await exitValidator.setWithdrawManager(withdrawManager.address)
// await nonceValidator.setWithdrawManager(withdrawManager.address)
// await _ERC721Validator.setWithdrawManager(withdrawManager.address)
// await depositValidator.setWithdrawManager(withdrawManager.address)

// await txValidator.setChildChainContract(childContract.address)
// await _ERC20Validator.setChildChainContract(childContract.address)
// await exitValidator.setChildChainContract(childContract.address)
// await nonceValidator.setChildChainContract(childContract.address)
// await _ERC721Validator.setChildChainContract(childContract.address)
// await depositValidator.setChildChainContract(childContract.address)
