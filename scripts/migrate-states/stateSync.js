const Web3 = require('web3');
const { oldChain, newChain, fromAccount, privateKey, newChainId } = require('./util');

const contractJson = require('../../build/contracts/StateSender.json');
const abi = contractJson.abi;

const contractAddress1 = '0x6E3DfF195E068A6dDc24D845014469D03bF17cb9'; // StateSender contract address on Chain 1
const contractAddress2 = '0x6E3DfF195E068A6dDc24D845014469D03bF17cb9'; // StateSender contract address on Chain 2

const oldContract = new oldChain.eth.Contract(abi, contractAddress1);
const newContract = new newChain.eth.Contract(abi, contractAddress2);

module.exports = async function (callback) {
    try {
        // Read internal state from StateSender contract on Chain 1
        const counter = await oldContract.methods.counter().call();
        console.log(`Counter value: ${counter}`);

        // Write the state to StateSender contract on Chain 2
        const gasPrice = await newChain.eth.getGasPrice();
        const setCounterTx = newContract.methods.setCounter(counter);
        const gasLimit = await setCounterTx.estimateGas({ from: fromAccount });

        const txData = {
            to: contractAddress2,
            data: setCounterTx.encodeABI(),
            gas: gasLimit,
            chainId: newChainId,
        };

        const signedTx = await newChain.eth.accounts.signTransaction(txData, privateKey);
        const receipt = await newChain.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(`Transaction receipt: ${JSON.stringify(receipt)}`);
        const newCounter = await newContract.methods.counter().call();
        console.log(`Counter value for new contract: ${newCounter}`);
    } catch (e) {
        console.log(e);
    }

    callback();
};