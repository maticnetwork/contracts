const ethUtils = require('ethereumjs-util')
const bluebird = require('bluebird')
const utils = require('./utils')

const Registry = artifacts.require('Registry')
const DepositManagerProxy = artifacts.require('DepositManagerProxy')
const StateSender = artifacts.require('StateSender')
const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const SlashingManager = artifacts.require('SlashingManager')
const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC721Predicate = artifacts.require('ERC721Predicate')
const MarketplacePredicate = artifacts.require('MarketplacePredicate')
const TransferWithSigPredicate = artifacts.require('TransferWithSigPredicate')
const MaticWeth = artifacts.require('MaticWETH')
const Governance = artifacts.require('Governance')
const EventsHubProxy = artifacts.require('EventsHubProxy')

module.exports = async function(deployer) {
  deployer.then(async() => {
    await bluebird
      .all([
        Governance.deployed(),
        Registry.deployed(),
        DepositManagerProxy.deployed(),
        StateSender.deployed(),
        WithdrawManagerProxy.deployed(),
        StakeManagerProxy.deployed(),
        SlashingManager.deployed(),
        ERC20Predicate.deployed(),
        ERC721Predicate.deployed(),
        MarketplacePredicate.deployed(),
        TransferWithSigPredicate.deployed(),
        EventsHubProxy.deployed()
      ])
      .spread(async function(
        governance,
        registry,
        depositManagerProxy,
        stateSender,
        withdrawManagerProxy,
        stakeManagerProxy,
        slashingManager,
        ERC20Predicate,
        ERC721Predicate,
        MarketplacePredicate,
        TransferWithSigPredicate,
        EventsHubProxy
      ) {
        await utils.updateContractMap(
          governance,
          registry,
          'depositManager',
          depositManagerProxy.address
        )
        await utils.updateContractMap(
          governance,
          registry,
          'withdrawManager',
          withdrawManagerProxy.address
        )
        await utils.updateContractMap(
          governance,
          registry,
          'stakeManager',
          stakeManagerProxy.address
        )
        await utils.updateContractMap(
          governance,
          registry,
          'slashingManager',
          slashingManager.address
        )
        await utils.updateContractMap(
          governance,
          registry,
          'stateSender',
          stateSender.address
        )
        await utils.updateContractMap(
          governance,
          registry,
          'wethToken',
          MaticWeth.address
        )
        await utils.updateContractMap(
          governance,
          registry,
          'eventsHub',
          EventsHubProxy.address
        )

        // whitelist predicates
        await governance.update(
          registry.address,
          registry.contract.methods.addErc20Predicate(ERC20Predicate.address).encodeABI()
        )

        await governance.update(
          registry.address,
          registry.contract.methods.addErc721Predicate(ERC721Predicate.address).encodeABI()
        )

        await governance.update(
          registry.address,
          registry.contract.methods.addPredicate(MarketplacePredicate.address, 3).encodeABI()
        )
        await governance.update(
          registry.address,
          registry.contract.methods.addPredicate(TransferWithSigPredicate.address, 3).encodeABI()
        )
      })
  })
}
