import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import deployer from "../../helpers/deployer.js";
import logDecoder from "../../helpers/log-decoder.js";
import { generateFirstWallets, mnemonics } from "../../helpers/wallets.js";
import * as utils from "../../helpers/utils";

const crypto = require("crypto");

chai.use(chaiAsPromised).should();

const wallets = generateFirstWallets(mnemonics, 1);
const alice = utils.toChecksumAddress(wallets[0].getAddressString());
const bob = utils.toChecksumAddress(
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

  it("transfer - no parent", async function () {
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

  it("transfer - user allowed in parent", async function () {
    const depositAmount = web3.utils.toBN("10");
    const transferAmount = web3.utils.toBN("3");

    const parentToken = await deployer.deploySubredditParent();
    await erc20.childToken.setParent(parentToken.address, {
      from: subredditOwner,
    });
    // allow transfer from alice
    await parentToken.updatePermission(alice, true);

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

  it("transfer - user restricted in parent", async function () {
    const depositAmount = web3.utils.toBN("10");
    const transferAmount = web3.utils.toBN("3");

    const parentToken = await deployer.deploySubredditParent();
    await erc20.childToken.setParent(parentToken.address, {
      from: subredditOwner,
    });
    // restrict transfer from alice
    await parentToken.updatePermission(alice, false);

    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      alice,
      depositAmount
    );
    await erc20.childToken.transfer(bob, transferAmount, { from: alice });

    const aliceBalance = depositAmount;
    assert.strictEqual(
      (await erc20.childToken.balanceOf(alice)).toString(),
      aliceBalance.toString()
    );
    const bobBalance = web3.utils.toBN("0");
    assert.strictEqual(
      (await erc20.childToken.balanceOf(bob)).toString(),
      bobBalance.toString()
    );
  });

  it("transferWithPurpose", async function () {
    const depositAmount = web3.utils.toBN("10");
    const transferAmount = web3.utils.toBN("3");

    const parentToken = await deployer.deploySubredditParent();
    await erc20.childToken.setParent(parentToken.address, {
      from: subredditOwner,
    });
    await parentToken.updatePermission(alice, true);

    await utils.deposit(
      null,
      childContracts.childChain,
      erc20.rootERC20,
      alice,
      depositAmount
    );
    const { receipt } = await erc20.childToken.transferWithPurpose(
      bob,
      transferAmount,
      ["0xaa", "0xbb"],
      { from: alice }
    );

    const parsedLogs = logDecoder.decodeLogs(receipt.rawLogs);
    assert.equal(parsedLogs[0].event, "Purpose");
    expect(parsedLogs[0].args).to.include({ purpose: "0xaabb" });

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
});
