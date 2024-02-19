const Web3 = require('web3');
const { oldChain, newChain, fromAccount, privateKey, newChainId } = require('./util');

const contractJson = require('../../build/contracts/StakingInfo.json');
const abi = contractJson.abi;

const contractAddress1 = '0x88B97C24099185FFa54DC8e78293B9D7a60463c2'; // StakingInfo contract address on Chain 1
const contractAddress2 = '0x88B97C24099185FFa54DC8e78293B9D7a60463c2'; // StakingInfo contract address on Chain 2

const oldContract = new oldChain.eth.Contract(abi, contractAddress1);
const newContract = new newChain.eth.Contract(abi, contractAddress2);

module.exports = async function (callback) {
  try {

    const validatorIds = [];
    const nonces = [];

    for (let validatorId = 1; validatorId <= 150; validatorId++) {
      const nonce = await oldContract.methods.validatorNonce(validatorId).call();
      if (nonce === '0' || nonce === 0) {
        continue;
      }
      validatorIds.push(validatorId);
      nonces.push(nonce);
    }

    console.log('validatorIds', validatorIds);
    console.log('nonces', nonces);

    const tx = newContract.methods.updateNonce(validatorIds, nonces);
    const gasPrice = await newChain.eth.getGasPrice();
    const gasLimit = await tx.estimateGas({ from: fromAccount });

    const txData = {
      to: contractAddress2,
      data: tx.encodeABI(),
      gas: gasLimit,
      gasPrice: gasPrice,
      chainId: newChainId,
    };

    const signedTx = await newChain.eth.accounts.signTransaction(txData, privateKey);
    const receipt = await newChain.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`Transaction receipt: ${JSON.stringify(receipt)}`);
    for (let i = 0; i < validatorIds.length; i++) {
      const validatorId = validatorIds[i];
      const nonce = nonces[i];
      const newNonce = await newContract.methods.validatorNonce(validatorId).call();
      if (newNonce !== nonce) {
        throw new Error(`Nonce for validator ${validatorId} is not updated. Expected ${nonce}, got ${newNonce}`);
      }
    }

    console.log('All nonces are updated');
  } catch (e) {
    console.log(e);
  }

  callback();
};