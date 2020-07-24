import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import deployer from "../../helpers/deployer.js";
import { generateFirstWallets, mnemonics } from "../../helpers/wallets.js";
import * as utils from "../../helpers/utils";

const crypto = require("crypto");

chai.use(chaiAsPromised).should();

const wallets = generateFirstWallets(mnemonics, 1);
const alice = utils.toChecksumAddress(wallets[0].getAddressString());
const bob = utils.toChecksumAddress(
  "0x" + crypto.randomBytes(20).toString("hex")
);
const charlie = utils.toChecksumAddress(
  "0x" + crypto.randomBytes(20).toString("hex")
);

contract.only("SubredditChild", async function (accounts) {
  let childContracts, erc20;
  const maticOwner = accounts[0];
  const subredditOwner = accounts[1];

  before(async function () {
    childContracts = await deployer.initializeChildChain(maticOwner, {
      updateRegistry: false,
    });
  });

  beforeEach(async function () {
    erc20 = await deployer.deploySubredditChild(subredditOwner, {
      mapToken: false,
    });
  });

  it("transfer", async function () {
    const depositAmount = web3.utils.toBN("10");
    const transferAmount = web3.utils.toBN("3");
    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      alice,
      depositAmount
    );

    await erc20.childToken.transfer(bob, transferAmount, { from: alice });

    const aliceBalance = depositAmount.sub(transferAmount);
    assert.strictEqual(
      (await erc20.childToken.balanceOf(alice)).toString(),
      aliceBalance.toString()
    );
    const bobBalance = transferAmount;
    assert.strictEqual(
      (await erc20.childToken.balanceOf(bob)).toString(),
      bobBalance.toString()
    );
  });

  it("transferBatchIdempotent - transfer to all", async function () {
    const depositToAliceAmount = web3.utils.toBN("10");
    const depositToBobAmount = web3.utils.toBN("11");
    const transferToBobAmount = web3.utils.toBN("2");
    const transferToCharlieAmount = web3.utils.toBN("3");

    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      alice,
      depositToAliceAmount
    );
    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      bob,
      depositToBobAmount
    );

    await erc20.childToken.transferBatchIdempotent(
      [bob, charlie],
      [transferToBobAmount, transferToCharlieAmount],
      false, // expectZero
      { from: alice }
    );

    const aliceBalance = depositToAliceAmount
      .sub(transferToBobAmount)
      .sub(transferToCharlieAmount);
    assert.strictEqual(
      (await erc20.childToken.balanceOf(alice)).toString(),
      aliceBalance.toString()
    );

    const bobBalance = depositToBobAmount.add(transferToBobAmount);
    assert.strictEqual(
      (await erc20.childToken.balanceOf(bob)).toString(),
      bobBalance.toString()
    );

    const charlieBalance = transferToCharlieAmount;
    assert.strictEqual(
      (await erc20.childToken.balanceOf(charlie)).toString(),
      charlieBalance.toString()
    );
  });

  it("transferBatchIdempotent - transfer to non zero only", async function () {
    const depositToAliceAmount = web3.utils.toBN("10");
    const depositToBobAmount = web3.utils.toBN("11");
    const transferToBobAmount = web3.utils.toBN("2");
    const transferToCharlieAmount = web3.utils.toBN("3");

    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      alice,
      depositToAliceAmount
    );
    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      bob,
      depositToBobAmount
    );

    assert.strictEqual(
      (await erc20.childToken.balanceOf(alice)).toString(),
      depositToAliceAmount.toString()
    );
    assert.strictEqual(
      (await erc20.childToken.balanceOf(bob)).toString(),
      depositToBobAmount.toString()
    );
    assert.strictEqual(
      (await erc20.childToken.balanceOf(charlie)).toString(),
      "0"
    );

    await erc20.childToken.transferBatchIdempotent(
      [bob, charlie],
      [transferToBobAmount, transferToCharlieAmount],
      true, // expectZero
      { from: alice }
    );

    const aliceBalance = depositToAliceAmount.sub(transferToCharlieAmount);
    assert.strictEqual(
      (await erc20.childToken.balanceOf(alice)).toString(),
      aliceBalance.toString()
    );

    const bobBalance = depositToBobAmount;
    // since bob's balance was non-zero, he didn't get any tokens
    assert.strictEqual(
      (await erc20.childToken.balanceOf(bob)).toString(),
      bobBalance.toString()
    );

    const charlieBalance = transferToCharlieAmount;
    assert.strictEqual(
      (await erc20.childToken.balanceOf(charlie)).toString(),
      charlieBalance.toString()
    );
  });
});
