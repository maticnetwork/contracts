const ethUtils = require('ethereumjs-util')

console.log(
  ethUtils.keccak256('Deposit(address,address,uint256,uint256,uint256)').toString('hex'),
  ethUtils.keccak256('Withdraw(address,address,uint256,uint256,uint256)').toString('hex'),
  ethUtils.keccak256('LogTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)').toString('hex'),
  ethUtils.keccak256('LogFeeTransfer(address,address,address,uint256,uint256,uint256,uint256,uint256)').toString('hex')
)
