/* global artifacts */

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
// proofs
//
const TxValidator = artifacts.require('./proofs/TxValidator.sol')
const ERC20Validator = artifacts.require('./proofs/ERC20Validator.sol')
const ExitValidator = artifacts.require('./proofs/ExitValidator.sol')
const NonceValidator = artifacts.require('./proofs/NonceValidator.sol')
const ERC721Validator = artifacts.require('./proofs/ERC721Validator.sol')
const DepositValidator = artifacts.require('./proofs/DepositValidator.sol')

module.exports = async function(deployer, network) {
  console.log(`${network} : network`)
  deployer.then(async() => {
    const depositManager = await DepositManager.deployed()
    const withdrawManager = await WithdrawManager.deployed()
    const stakeManager = await StakeManager.deployed()
    const rootChain = await RootChain.deployed()
    const exitNFT = await ExitNFT.deployed()
    const txValidator = await TxValidator.deployed()
    const _ERC20Validator = await ERC20Validator.deployed()
    const exitValidator = await ExitValidator.deployed()
    const nonceValidator = await NonceValidator.deployed()
    const _ERC721Validator = await ERC721Validator.deployed()
    const depositValidator = await DepositValidator.deployed()
    const maticWETH = await MaticWETH.deployed()
    const rootToken = await RootToken.deployed()

    const contractAddresses = {
      // @todo add all of the above
      RootToken: rootToken.address
    }
    fs.writeFileSync(
      './build/contractAddresses.json',
      JSON.stringify(contractAddresses, null, 4) // Indent 4 spaces
    )

    await stakeManager.setToken(rootToken.address)

    // set rootchain
    await exitNFT.changeRootChain(rootChain.address)
    await stakeManager.changeRootChain(rootChain.address)
    await depositManager.changeRootChain(rootChain.address)
    await withdrawManager.changeRootChain(rootChain.address)
    // proof validators
    await txValidator.changeRootChain(rootChain.address)
    await _ERC20Validator.changeRootChain(rootChain.address)
    await exitValidator.changeRootChain(rootChain.address)
    await nonceValidator.changeRootChain(rootChain.address)
    await _ERC721Validator.changeRootChain(rootChain.address)
    await depositValidator.changeRootChain(rootChain.address)

    await txValidator.setDepositManager(depositManager.address)
    await _ERC20Validator.setDepositManager(depositManager.address)
    await exitValidator.setDepositManager(depositManager.address)
    await nonceValidator.setDepositManager(depositManager.address)
    await _ERC721Validator.setDepositManager(depositManager.address)
    await depositValidator.setDepositManager(depositManager.address)

    await txValidator.setWithdrawManager(withdrawManager.address)
    await _ERC20Validator.setWithdrawManager(withdrawManager.address)
    await exitValidator.setWithdrawManager(withdrawManager.address)
    await nonceValidator.setWithdrawManager(withdrawManager.address)
    await _ERC721Validator.setWithdrawManager(withdrawManager.address)
    await depositValidator.setWithdrawManager(withdrawManager.address)

    // await rootChain.setChildContract(childContract.address)
    // await txValidator.setChildChainContract(childContract.address)
    // await _ERC20Validator.setChildChainContract(childContract.address)
    // await exitValidator.setChildChainContract(childContract.address)
    // await nonceValidator.setChildChainContract(childContract.address)
    // await _ERC721Validator.setChildChainContract(childContract.address)
    // await depositValidator.setChildChainContract(childContract.address)

    await rootChain.setStakeManager(stakeManager.address)

    await rootChain.setDepositManager(depositManager.address)
    await rootChain.setWithdrawManager(withdrawManager.address)

    await rootChain.setExitNFTContract(exitNFT.address)
    await rootChain.setWETHToken(maticWETH.address)

    await withdrawManager.setDepositManager(depositManager.address)
    await rootChain.addProofValidator(txValidator.address)
    await rootChain.addProofValidator(_ERC20Validator.address)
    await rootChain.addProofValidator(exitValidator.address)
    await rootChain.addProofValidator(nonceValidator.address)
    await rootChain.addProofValidator(_ERC721Validator.address)
    await rootChain.addProofValidator(depositValidator.address)
  })
}
