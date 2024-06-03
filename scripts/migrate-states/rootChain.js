const Web3 = require('web3');
const { oldChain, newChain, fromAccount, privateKey, newChainId } = require('./util');

const contractJson = require('../../build/contracts/RootChain.json');
const abi = contractJson.abi;

const contractAddress1 = '0x47bf9dc50D5D8d676AFBE714766dFF84C1828AE9'; // RootChain proxy contract address on Chain 1
const contractAddress2 = '0xcB6cb787A98448C586F2f74d55f1B3d0EA29F1e7'; // RootChain proxy contract address on Chain 2

const oldContract = new oldChain.eth.Contract(abi, contractAddress1);
const newContract = new newChain.eth.Contract(abi, contractAddress2);

module.exports = async function (callback) {
  try {
    // Read internal state from RootChain contract on Chain 1
    const currentHeaderBlock = await oldContract.methods.currentHeaderBlock().call();
    const headerBlock = await oldContract.methods.headerBlocks(currentHeaderBlock).call();

    console.log(`Current header block on old chain: ${currentHeaderBlock}`)
    console.log(`Current header block. Start: ${headerBlock.start}, end: ${headerBlock.end}`);

    // Write the state to RootChain contract on Chain 2
    const gasPrice = await newChain.eth.getGasPrice();

    // Call overrideHeaderBlock
    const overrideHeaderBlockTx = newContract.methods.overrideHeaderBlock(
      parseInt(currentHeaderBlock) + 10000,
      headerBlock.proposer,
      headerBlock.start,
      headerBlock.end,
      headerBlock.root
    );
    const gasLimit = await overrideHeaderBlockTx.estimateGas({ from: fromAccount });

    const txData = {
      to: contractAddress2,
      data: overrideHeaderBlockTx.encodeABI(),
      gas: gasLimit,
      gasPrice: gasPrice,
      chainId: newChainId,
    };

    const signedTx = await newChain.eth.accounts.signTransaction(txData, privateKey);
    const receipt = await newChain.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`OverrideHeaderBlock transaction receipt: ${JSON.stringify(receipt)}`);

    const currentHeaderBlockNewChain = parseInt(await newContract.methods.currentHeaderBlock().call());
    console.log(`Current header block on new chain: ${currentHeaderBlockNewChain}`);
    const headerBlockNewChain = await newContract.methods.headerBlocks(currentHeaderBlockNewChain).call();

    console.log(`Current header block: Start: ${headerBlockNewChain.start}, end: ${headerBlockNewChain.end}`);
  } catch (e) {
    console.log(e);
  }

  callback();
};