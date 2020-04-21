/*jshint esversion: 9 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import utils from 'ethereumjs-util';

import {
    StakeManager,
    DummyERC20,
    StakingInfo,
    ValidatorShare,
    ValidatorShareFactory,
    DrainStakeManager
} from '../helpers/artifacts';

import deployer from '../helpers/deployer.js';
import logDecoder from '../helpers/log-decoder.js';
import { rewradsTreeFee } from '../helpers/proofs.js';

import {
    checkPoint,
    assertBigNumbergt,
    assertBigNumberEquality,
    buildSubmitHeaderBlockPaylod
} from '../helpers/utils.js';

import { generateFirstWallets, mnemonics } from '../helpers/wallets.js';

chai.use(chaiAsPromised).should();

contract('DrainStakeManager', async function ([owner, ...accounts]) {
    describe('Upgrade and drain staking contract', async function () {
        before(async function () {
            this.wallets = generateFirstWallets(mnemonics, 10);
            let contracts = await deployer.deployStakeManager(this.wallets);

            this.stakeToken = contracts.stakeToken;
            this.stakeManager = contracts.stakeManager;
            this.contracts = contracts;

            await stakeManager.updateCheckPointBlockInterval(1);

            await stakeToken.mint(
                stakeManager.address,
                web3.utils.toWei('90000')
            );
        });

        it("must lock stake manager", async function () {
            await this.contracts.governance.update(
                this.stakeManager.address,
                this.stakeManager.contract.methods.lock().encodeABI()
            );
            (await this.stakeManager.locked()).should.be.equal(true);
        });

        it("must swap implementaion", async function () {
            const newImpl = await DrainStakeManager.new();
            await this.stakeManager.updateImplementation(newImpl.address);
        });

        describe("drain()", function() {
            it("must fail draining when not drained by governance", async function () {
                const balance = await this.stakeToken.balanceOf(this.stakeManager.address);
                try {
                    await this.stakeManager.drain(owner, balance);
                    assert.fail('Funds should not be drained');
                } catch (error) {
                    assert(error.message.search('revert') >= 0, "Expected revert, got '" + error + "' instead");
                    assert(error.message.search("Only governance contract is authorized") >= 0, `Expected 'Only governance contract is authorized', got ${error} instead`);
                }
            });

            it("must drain all funds when drained by governance", async function () {
                const balance = await this.stakeToken.balanceOf(this.stakeManager.address);
                await this.contracts.governance.update(
                    this.stakeManager.address,
                    this.stakeManager.contract.methods.drain(owner, balance).encodeABI()
                );
                (await this.stakeToken.balanceOf(this.stakeManager.address)).toString().should.be.equal("0");
            });
        });
    });
});