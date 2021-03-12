const ethUtils = require('ethereumjs-util')
const bluebird = require('bluebird')
const utils = require('./utils')
const Registry = artifacts.require('Registry')
const ValidatorShare = artifacts.require('ValidatorShare')
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

async function updateContractMap(governance, registry, nameHash, value) {
  return governance.update(
    registry.address,
    registry.contract.methods.updateContractMap(nameHash, value).encodeABI()
  )
}

module.exports = async function(deployer) {
  deployer.then(async() => {
    const contractAddresses = utils.getContractAddresses()
    const governance = await Governance.at(contractAddresses.root.GovernanceProxy)

    await bluebird
      .all([
        Registry.deployed(),
        ValidatorShare.deployed(),
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
        registry,
        validatorShare,
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
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('validatorShare'),
          validatorShare.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('depositManager'),
          depositManagerProxy.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('withdrawManager'),
          withdrawManagerProxy.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('stakeManager'),
          stakeManagerProxy.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('slashingManager'),
          slashingManager.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('stateSender'),
          stateSender.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('wethToken'),
          MaticWeth.address
        )
        await updateContractMap(
          governance,
          registry,
          ethUtils.keccak256('eventsHub'),
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
