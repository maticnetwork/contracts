import { ethers } from "hardhat";

const bluebird = require('bluebird')

const Merkle = artifacts.require('Merkle')
const MerklePatriciaProof = artifacts.require('MerklePatriciaProof')
const RLPReader = artifacts.require('RLPReader')
const SafeERC20 = artifacts.require('SafeERC20')
const SafeMath = artifacts.require('SafeMath')

const RootChainManager = artifacts.require('RootChainManager')
const RootChainManagerProxy = artifacts.require('RootChainManagerProxy')
const DummyStateSender = artifacts.require('DummyStateSender')

const ERC20Predicate = artifacts.require('ERC20Predicate')
const ERC20PredicateProxy = artifacts.require('ERC20PredicateProxy')
const MintableERC20Predicate = artifacts.require('MintableERC20Predicate')
const MintableERC20PredicateProxy = artifacts.require('MintableERC20PredicateProxy')

const ERC721Predicate = artifacts.require('ERC721Predicate')
const ERC721PredicateProxy = artifacts.require('ERC721PredicateProxy')
const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
const MintableERC721PredicateProxy = artifacts.require('MintableERC721PredicateProxy')

const ERC1155Predicate = artifacts.require('ERC1155Predicate')
const ERC1155PredicateProxy = artifacts.require('ERC1155PredicateProxy')
const MintableERC1155Predicate = artifacts.require('MintableERC1155Predicate')
const MintableERC1155PredicateProxy = artifacts.require('MintableERC1155PredicateProxy')

const EtherPredicate = artifacts.require('EtherPredicate')
const EtherPredicateProxy = artifacts.require('EtherPredicateProxy')

const DummyERC20 = artifacts.require('DummyERC20')
const DummyMintableERC20 = artifacts.require('DummyMintableERC20')

const DummyERC721 = artifacts.require('DummyERC721')
const DummyMintableERC721 = artifacts.require('DummyMintableERC721')

const DummyERC1155 = artifacts.require('DummyERC1155')
const DummyMintableERC1155 = artifacts.require('DummyMintableERC1155')

const TestRootTunnel = artifacts.require('TestRootTunnel')
const TestChildTunnel = artifacts.require('TestChildTunnel')


// ---------------------------------- 3 ----------------------------------------//
const ChildChainManager = artifacts.require('ChildChainManager')
const ChildChainManagerProxy = artifacts.require('ChildChainManagerProxy')

const ChildERC20 = artifacts.require('ChildERC20')
const ChildMintableERC20 = artifacts.require('ChildMintableERC20')

const ChildERC721 = artifacts.require('ChildERC721')
const ChildMintableERC721 = artifacts.require('ChildMintableERC721')

const ChildERC1155 = artifacts.require('ChildERC1155')
const ChildMintableERC1155 = artifacts.require('ChildMintableERC1155')

const MaticWETH = artifacts.require('MaticWETH')

// ---------------------------------- 4 ----------------------------------------//
// const RootChainManager = artifacts.require('RootChainManager')

// const ERC20Predicate = artifacts.require('ERC20Predicate')
// const MintableERC20Predicate = artifacts.require('MintableERC20Predicate')

// const ERC721Predicate = artifacts.require('ERC721Predicate')
// const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')

// const ERC1155Predicate = artifacts.require('ERC1155Predicate')
// const MintableERC1155Predicate = artifacts.require('MintableERC1155Predicate')

// const EtherPredicate = artifacts.require('EtherPredicate')

// const DummyMintableERC20 = artifacts.require('DummyMintableERC20')
// const DummyMintableERC721 = artifacts.require('DummyMintableERC721')
// const DummyMintableERC1155 = artifacts.require('DummyMintableERC1155')

const utils = require('../migrations/utils')
const config = require('../migrations/config')

module.exports = async(deployer, network, accounts) => {
  
  console.log("2_deploy_root_chain_contracts");
  await deployer

  const signers = await ethers.getSigners();
  const account = await signers[0].getAddress();

  console.log('deploying contracts...')

  const rootChainManager = await RootChainManager.new();
  RootChainManager.setAsDeployed(rootChainManager);

  const rootChainManagerProxy = await RootChainManagerProxy.new('0x0000000000000000000000000000000000000000');
  RootChainManagerProxy.setAsDeployed(rootChainManagerProxy);
  
  await rootChainManagerProxy.updateAndCall(rootChainManager.address, rootChainManager.contract.methods.initialize(account).encodeABI())


  // -- ERC20 Predicates Deployment, starting
  const erc20Predicate = await ERC20Predicate.new();
  ERC20Predicate.setAsDeployed(erc20Predicate);

  const erc20PredicateProxy = await ERC20PredicateProxy.new('0x0000000000000000000000000000000000000000');
  ERC20PredicateProxy.setAsDeployed(erc20PredicateProxy);

  await erc20PredicateProxy.updateAndCall(erc20Predicate.address, erc20Predicate.contract.methods.initialize(account).encodeABI())

  // Mintable version of ERC20 👇
  const mintableErc20Predicate = await MintableERC20Predicate.new();
  MintableERC20Predicate.setAsDeployed(mintableErc20Predicate);

  const mintableErc20PredicateProxy = await MintableERC20PredicateProxy.new('0x0000000000000000000000000000000000000000');
  MintableERC20PredicateProxy.setAsDeployed(mintableErc20PredicateProxy);

  await mintableErc20PredicateProxy.updateAndCall(mintableErc20Predicate.address, mintableErc20Predicate.contract.methods.initialize(account).encodeABI())
  // -- ERC20 Predicates Deployment, ending

  // -- ERC721 Predicates Deployment, starting
  const erc721Predicate = await ERC721Predicate.new();
  ERC721Predicate.setAsDeployed(erc721Predicate);

  const erc721PredicateProxy = await ERC721PredicateProxy.new('0x0000000000000000000000000000000000000000');
  ERC721PredicateProxy.setAsDeployed(erc721PredicateProxy);
  await erc721PredicateProxy.updateAndCall(erc721Predicate.address, erc721Predicate.contract.methods.initialize(account).encodeABI())

  // Mintable version of ERC721 👇
  const mintableERC721Predicate = await MintableERC721Predicate.new();
  MintableERC721Predicate.setAsDeployed(mintableERC721Predicate);

  const mintableERC721PredicateProxy = await MintableERC721PredicateProxy.new('0x0000000000000000000000000000000000000000');
  MintableERC721PredicateProxy.setAsDeployed(mintableERC721PredicateProxy);
  await mintableERC721PredicateProxy.updateAndCall(mintableERC721Predicate.address, mintableERC721Predicate.contract.methods.initialize(account).encodeABI())
  // -- ERC721 Predicates Deployment, ending

  // -- ERC1155 Predicates Deployment, starting
  const erc1155Predicate = await ERC1155Predicate.new();
  ERC1155Predicate.setAsDeployed(erc1155Predicate);

  const erc1155PredicateProxy = await ERC1155PredicateProxy.new('0x0000000000000000000000000000000000000000');
  ERC1155PredicateProxy.setAsDeployed(erc1155PredicateProxy);
  await erc1155PredicateProxy.updateAndCall(erc1155Predicate.address, erc1155Predicate.contract.methods.initialize(account).encodeABI())

  // Mintable version of ERC1155 👇
  const mintableErc1155Predicate = await MintableERC1155Predicate.new();
  MintableERC1155Predicate.setAsDeployed(mintableErc1155Predicate);

  const mintableErc1155PredicateProxy = await MintableERC1155PredicateProxy.new('0x0000000000000000000000000000000000000000');
  MintableERC1155PredicateProxy.setAsDeployed(mintableErc1155PredicateProxy);

  await mintableErc1155PredicateProxy.updateAndCall(mintableErc1155Predicate.address, mintableErc1155Predicate.contract.methods.initialize(account).encodeABI())
  // -- ERC721 Predicates Deployment, ending

  const etherPredicate = await EtherPredicate.new();
  EtherPredicate.setAsDeployed(etherPredicate);

  const etherPredicateProxy = await EtherPredicateProxy.new('0x0000000000000000000000000000000000000000');
  EtherPredicateProxy.setAsDeployed(etherPredicateProxy);
  await etherPredicateProxy.updateAndCall(etherPredicate.address, etherPredicate.contract.methods.initialize(account).encodeABI())

  const dummyStateSender = await DummyStateSender.new();
  DummyStateSender.setAsDeployed(dummyStateSender);

  // -- Dummy version of ERC20
  const dummyERC20 = await DummyERC20.new('Dummy ERC20', 'DERC20');
  DummyERC20.setAsDeployed(dummyERC20);

  const dummyMintableERC20 = await DummyMintableERC20.new('Dummy Mintable ERC20', 'DERC20');
  DummyMintableERC20.setAsDeployed(dummyMintableERC20);
  // -- ends
  
  // -- Dummy version of ERC721
  const dummyERC721 = await DummyERC721.new('Dummy ERC721', 'DERC721');
  DummyERC721.setAsDeployed(dummyERC721);

  const dummyMintableERC721 = await DummyMintableERC721.new('Dummy Mintable ERC721', 'DMERC721');
  DummyMintableERC721.setAsDeployed(dummyMintableERC721);
  // -- ends

  // -- Dummy version of ERC1155
  const dummyERC1155 = await DummyERC1155.new('Dummy ERC1155');
  DummyERC1155.setAsDeployed(dummyERC1155);
  
  const dummyMintableERC1155 = await DummyMintableERC1155.new('Dummy Mintable ERC1155');
  DummyMintableERC1155.setAsDeployed(dummyMintableERC1155);
  // -- ends
  
  let contractAddresses = utils.getContractAddresses()

  contractAddresses.root.RootChainManager = rootChainManager.address
  contractAddresses.root.RootChainManagerProxy = rootChainManagerProxy.address

  contractAddresses.root.DummyStateSender = dummyStateSender.address

  contractAddresses.root.ERC20Predicate = erc20Predicate.address
  contractAddresses.root.ERC20PredicateProxy = erc20PredicateProxy.address
  contractAddresses.root.MintableERC20Predicate = mintableErc20Predicate.address
  contractAddresses.root.MintableERC20PredicateProxy = mintableErc20PredicateProxy.address
  
  contractAddresses.root.ERC721Predicate = erc721Predicate.address
  contractAddresses.root.ERC721PredicateProxy = erc721PredicateProxy.address
  contractAddresses.root.MintableERC721Predicate = mintableERC721Predicate.address
  contractAddresses.root.MintableERC721PredicateProxy = mintableERC721PredicateProxy.address
  
  contractAddresses.root.ERC1155Predicate = erc1155Predicate.address
  contractAddresses.root.ERC1155PredicateProxy = erc1155PredicateProxy.address
  contractAddresses.root.MintableERC1155Predicate = mintableErc1155Predicate.address
  contractAddresses.root.MintableERC1155PredicateProxy = mintableErc1155PredicateProxy.address
  
  contractAddresses.root.EtherPredicate = etherPredicate.address
  contractAddresses.root.EtherPredicateProxy = etherPredicateProxy.address
  
  console.log("ROOT DUMMY ERC20 address: ", dummyERC20.address);
  contractAddresses.root.DummyERC20 = dummyERC20.address
  contractAddresses.root.DummyMintableERC20 = dummyMintableERC20.address
  
  contractAddresses.root.DummyERC721 = dummyERC721.address
  contractAddresses.root.DummyMintableERC721 = dummyMintableERC721.address
  
  contractAddresses.root.DummyERC1155 = dummyERC1155.address
  contractAddresses.root.DummyMintableERC1155 = dummyMintableERC1155.address

//   utils.writeContractAddresses(contractAddresses)

  //------------------------------- 3 -------------------------------------//
  console.log("3_deploy_child_chain_contracts");
//   deployer.then(async() => {
//   await deployer
  
  const childChainManager = await ChildChainManager.new();
  ChildChainManager.setAsDeployed(childChainManager);
  
  const childChainManagerProxy = await ChildChainManagerProxy.new('0x0000000000000000000000000000000000000000');
  ChildChainManagerProxy.setAsDeployed(childChainManagerProxy);

  await childChainManagerProxy.updateAndCall(childChainManager.address, childChainManager.contract.methods.initialize(account).encodeABI())

  const childERC20 = await ChildERC20.new('Dummy ERC20', 'DERC20', 18, childChainManagerProxy.address);
  ChildERC20.setAsDeployed(childERC20);

  const childMintableERC20 = await ChildMintableERC20.new('Dummy Mintable ERC20', 'DMERC20', 18, childChainManagerProxy.address);
  ChildMintableERC20.setAsDeployed(childMintableERC20);

  const childERC721 = await ChildERC721.new('Dummy ERC721', 'DERC721', childChainManagerProxy.address);
  ChildERC721.setAsDeployed(childERC721);

  const childMintableERC721 = await ChildMintableERC721.new('Dummy Mintable ERC721', 'DMERC721', childChainManagerProxy.address);
  ChildMintableERC721.setAsDeployed(childMintableERC721);

  const childERC1155 = await ChildERC1155.new('Dummy ERC1155', childChainManagerProxy.address);
  ChildERC1155.setAsDeployed(childERC1155);

  const childMintableERC1155 = await ChildMintableERC1155.new('Dummy Mintable ERC1155', childChainManagerProxy.address);
  ChildMintableERC1155.setAsDeployed(childMintableERC1155);
    
  const maticWETH = await MaticWETH.new(childChainManagerProxy.address);
  MaticWETH.setAsDeployed(maticWETH);

//   const contractAddresses = utils.getContractAddresses()

  contractAddresses.child.ChildChainManager = childChainManager.address
  contractAddresses.child.ChildChainManagerProxy = childChainManagerProxy.address

  console.log("Child DummyERC20 address: ", childERC20.address);
  contractAddresses.child.DummyERC20 = childERC20.address
  contractAddresses.child.DummyMintableERC20 = childMintableERC20.address

  contractAddresses.child.DummyERC721 = childERC721.address
  contractAddresses.child.DummyMintableERC721 = childMintableERC721.address

  contractAddresses.child.DummyERC1155 = childERC1155.address
  contractAddresses.child.DummyMintableERC1155 = childMintableERC1155.address

  contractAddresses.child.MaticWETH = maticWETH.address

//   utils.writeContractAddresses(contractAddressesChild)

  //----------------------------------------- 4 ---------------------------------------//
  console.log("4_initialize_root_chain_contracts");
//   const contractAddresses = utils.getContractAddresses()

  const RootChainManagerInstance = await RootChainManager.at(contractAddresses.root.RootChainManagerProxy)

  const ERC20PredicateInstance = await ERC20Predicate.at(contractAddresses.root.ERC20PredicateProxy)
  const MintableERC20PredicateInstance = await MintableERC20Predicate.at(contractAddresses.root.MintableERC20PredicateProxy)

  const ERC721PredicateInstance = await ERC721Predicate.at(contractAddresses.root.ERC721PredicateProxy)
  const MintableERC721PredicateInstance = await MintableERC721Predicate.at(contractAddresses.root.MintableERC721PredicateProxy)

  const ERC1155PredicateInstance = await ERC1155Predicate.at(contractAddresses.root.ERC1155PredicateProxy)
  const MintableERC1155PredicateInstance = await MintableERC1155Predicate.at(contractAddresses.root.MintableERC1155PredicateProxy)

  const EtherPredicateInstance = await EtherPredicate.at(contractAddresses.root.EtherPredicateProxy)

  const DummyMintableERC20Instance = await DummyMintableERC20.at(contractAddresses.root.DummyMintableERC20)
  const DummyMintableERC721Instance = await DummyMintableERC721.at(contractAddresses.root.DummyMintableERC721)
  const DummyMintableERC1155Instance = await DummyMintableERC1155.at(contractAddresses.root.DummyMintableERC1155)

  console.log('Setting StateSender')
  await RootChainManagerInstance.setStateSender(contractAddresses.root.DummyStateSender)

  console.log('Setting ChildChainManager')
  await RootChainManagerInstance.setChildChainManagerAddress(contractAddresses.child.ChildChainManagerProxy)

  console.log('Setting CheckpointManager')
  await RootChainManagerInstance.setCheckpointManager(config.plasmaRootChain)

  console.log('Granting manager role on ERC20Predicate')
  const MANAGER_ROLE = await ERC20PredicateInstance.MANAGER_ROLE()
  await ERC20PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on MintableERC20Predicate')
  await MintableERC20PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on ERC721Predicate')
  await ERC721PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on MintableERC721Predicate')
  await MintableERC721PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on ERC71155Predicate')
  await ERC1155PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on MintableERC71155Predicate')
  await MintableERC1155PredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  console.log('Granting manager role on EtherPredicate')
  await EtherPredicateInstance.grantRole(MANAGER_ROLE, RootChainManagerInstance.address)

  const PREDICATE_ROLE = await DummyMintableERC20Instance.PREDICATE_ROLE()

  console.log('Granting predicate role on DummyMintableERC20')
  await DummyMintableERC20Instance.grantRole(PREDICATE_ROLE, MintableERC20PredicateInstance.address)

  console.log('Granting predicate role on DummyMintableERC721')
  await DummyMintableERC721Instance.grantRole(PREDICATE_ROLE, MintableERC721PredicateInstance.address)

  console.log('Granting predicate role on DummyMintableERC1155')
  await DummyMintableERC1155Instance.grantRole(PREDICATE_ROLE, MintableERC1155PredicateInstance.address)

  console.log('Registering ERC20Predicate')
  const ERC20Type = await ERC20PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC20Type, ERC20PredicateInstance.address)

  console.log('Registering MintableERC20Predicate')
  const MintableERC20Type = await MintableERC20PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(MintableERC20Type, MintableERC20PredicateInstance.address)

  console.log('Registering ERC721Predicate')
  const ERC721Type = await ERC721PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC721Type, ERC721PredicateInstance.address)

  console.log('Registering MintableERC721Predicate')
  const MintableERC721Type = await MintableERC721PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(MintableERC721Type, MintableERC721PredicateInstance.address)

  console.log('Registering ERC1155Predicate')
  const ERC1155Type = await ERC1155PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(ERC1155Type, ERC1155PredicateInstance.address)

  console.log('Registering MintableERC1155Predicate')
  const MintableERC1155Type = await MintableERC1155PredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(MintableERC1155Type, MintableERC1155PredicateInstance.address)

  console.log('Registering EtherPredicate')
  const EtherType = await EtherPredicateInstance.TOKEN_TYPE()
  await RootChainManagerInstance.registerPredicate(EtherType, EtherPredicateInstance.address)

  console.log('Mapping DummyERC20')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC20, contractAddresses.child.DummyERC20, ERC20Type)

  console.log('Mapping DummyMintableERC20')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC20, contractAddresses.child.DummyMintableERC20, MintableERC20Type)

  console.log('Mapping DummyERC721')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC721, contractAddresses.child.DummyERC721, ERC721Type)

  console.log('Mapping DummyMintableERC721')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC721, contractAddresses.child.DummyMintableERC721, MintableERC721Type)

  console.log('Mapping DummyERC1155')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyERC1155, contractAddresses.child.DummyERC1155, ERC1155Type)

  console.log('Mapping DummyMintableERC1155')
  await RootChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC1155, contractAddresses.child.DummyMintableERC1155, MintableERC1155Type)

  console.log('Mapping Ether')
  await RootChainManagerInstance.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', contractAddresses.child.MaticWETH, EtherType)

  //----------------------------------------- 5 ---------------------------------------//
  console.log("5_initialize_child_chain_contracts");

  const ChildChainManagerInstance = await ChildChainManager.at(contractAddresses.child.ChildChainManagerProxy)

  console.log('Granting STATE_SYNCER_ROLE on ChildChainManager')
  const STATE_SYNCER_ROLE = await ChildChainManagerInstance.STATE_SYNCER_ROLE()
  await ChildChainManagerInstance.grantRole(STATE_SYNCER_ROLE, config.stateReceiver)

  console.log('Mapping DummyERC20')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyERC20, contractAddresses.child.DummyERC20)

  console.log('Mapping DummyMintableERC20')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC20, contractAddresses.child.DummyMintableERC20)

  console.log('Mapping DummyERC721')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyERC721, contractAddresses.child.DummyERC721)

  console.log('Mapping DummyMintableERC721')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC721, contractAddresses.child.DummyMintableERC721)

  console.log('Mapping DummyERC1155')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyERC1155, contractAddresses.child.DummyERC1155)

  console.log('Mapping DummyMintableERC1155')
  await ChildChainManagerInstance.mapToken(contractAddresses.root.DummyMintableERC1155, contractAddresses.child.DummyMintableERC1155)

  console.log('Mapping WETH')
  await ChildChainManagerInstance.mapToken('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', contractAddresses.child.MaticWETH)
}
