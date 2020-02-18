const ethUtils = require('ethereumjs-util')
const bluebird = require('bluebird')

const Registry = artifacts.require('Registry')
const RootChain = artifacts.require('RootChain')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const StateSender = artifacts.require('StateSender')
const WithdrawManager = artifacts.require('WithdrawManager')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StakeManager = artifacts.require('StakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const SlashingManager = artifacts.require('SlashingManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const MaticWeth = artifacts.require('MaticWETH')
const TestToken = artifacts.require('TestToken')

module.exports = async function (deployer, network) {
  deployer.then(async () => {
    console.log('initializing contract state...')
    await bluebird
      .all([
        TestToken.deployed(),
        Registry.deployed(),
        DepositManagerProxy.deployed(),
        StateSender.deployed(),
        WithdrawManagerProxy.deployed(),
        StakeManagerProxy.deployed(),
        SlashingManager.deployed(),
        MaticWeth.deployed(),
        ERC20Predicate.deployed(),
        ERC721Predicate.deployed(),
        MarketplacePredicate.deployed(),
        TransferWithSigPredicate.deployed()
      ])
      .spread(async function (
        testToken,
        registry,
        depositManagerProxy,
        stateSender,
        withdrawManagerProxy,
        stakeManagerProxy,
        slashingManager,
        maticWeth,
        ERC20Predicate,
        ERC721Predicate,
        MarketplacePredicate,
        TransferWithSigPredicate
      ) {
        let stakeManager = await StakeManager.at(stakeManagerProxy.address)
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
          ethUtils.keccak256('slashingManager'),
          slashingManager.address
        )
        await registry.updateContractMap(
          ethUtils.keccak256('stateSender'),
          stateSender.address
        )
        await stakeManager.setToken(testToken.address)

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
