const ethUtils = require('ethereumjs-util')
const bluebird = require('bluebird')

const Registry = artifacts.require('Registry')
const RootChain = artifacts.require('RootChain')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StakeManager = artifacts.require('StakeManager')
const DelegationManager = artifacts.require('DelegationManager')
const SlashingManager = artifacts.require('SlashingManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const ExitNFT = artifacts.require('ExitNFT')
const MaticWeth = artifacts.require('MaticWETH')
const TestToken = artifacts.require('TestToken')

module.exports = async function(deployer, network) {
  deployer.then(async() => {
    console.log('initializing contract state...')
    await bluebird
      .all([
        TestToken.deployed(),
        Registry.deployed(),
        RootChain.deployed(),
        DepositManagerProxy.deployed(),
        WithdrawManagerProxy.deployed(),
        StakeManager.deployed(),
        DelegationManager.deployed(),
        SlashingManager.deployed(),
        ExitNFT.deployed(),
        MaticWeth.deployed(),
        ERC20Predicate.deployed(),
        ERC721Predicate.deployed(),
        MarketplacePredicate.deployed(),
        TransferWithSigPredicate.deployed()
      ])
      .spread(async function(
        testToken,
        registry,
        rootChain,
        depositManagerProxy,
        withdrawManagerProxy,
        stakeManager,
        delegationManager,
        slashingManager,
        exitNFT,
        maticWeth,
        ERC20Predicate,
        ERC721Predicate,
        MarketplacePredicate,
        TransferWithSigPredicate
      ) {
        console.log('contract addresses', registry.address, maticWeth.address)
        const _withdrawManager = await WithdrawManager.at(
          withdrawManagerProxy.address
        )
        await _withdrawManager.setExitNFTContract(exitNFT.address)
        await registry.updateContractMap(
          ethUtils.keccak256('depositManager'),
          depositManagerProxy.address
        )
        await registry.updateContractMap(
          ethUtils.keccak256('withdrawManager'),
          withdrawManagerProxy.address
        )
        await registry.updateContractMap(
          ethUtils.keccak256('stakeManager'),
          stakeManager.address
        )
        await registry.updateContractMap(
          ethUtils.keccak256('delegationManager'),
          delegationManager.address
        )
        await registry.updateContractMap(
          ethUtils.keccak256('slashingManager'),
          slashingManager.address
        )
        await stakeManager.setToken(testToken.address)
        await stakeManager.changeRootChain(rootChain.address)

        // whitelist predicates
        await registry.addErc20Predicate(ERC20Predicate.address)
        await registry.addErc721Predicate(ERC721Predicate.address)
        await registry.addPredicate(
          MarketplacePredicate.address,
          3 /* Type.Custom */
        )
        await registry.addPredicate(
          TransferWithSigPredicate.address,
          3 /* Type.Custom */
        )

        // map weth contract
        await registry.updateContractMap(
          ethUtils.keccak256('wethToken'),
          MaticWeth.address
        )
      })
  })
}
