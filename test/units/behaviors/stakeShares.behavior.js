import { assertBigNumberEquality } from '../../helpers/utils'

export function shouldHaveCorrectStakeShares({ shares, validatorId, user } = {}) {
  it(`should have correct validator shares`, async function() {
    const sharesState = await this.stakeManager.sharesState(validatorId || this.validatorId)
    // console.log('sharesState.shares', sharesState.shares.toString())
    // console.log('sharesState.sharesPool', sharesState.sharesPool.toString())
    // console.log('sharesState.stakePool', sharesState.stakePool.toString())

    assertBigNumberEquality(shares || this.shares, sharesState.shares)
  })

  it(`should have correct shares pool`, async function() {
    const sharesK = await this.stakeManager.sharesK()
    const sharesPrecision = await this.stakeManager.SHARES_PRECISION()
    const sharesState = await this.stakeManager.sharesState(validatorId || this.validatorId)

    assertBigNumberEquality(sharesState.shares.add(sharesState.sharesPool), sharesK.mul(sharesPrecision))
  })

  it(`should have correct stake pool`, async function() {
    const sharesK = await this.stakeManager.sharesK()
    const sharesState = await this.stakeManager.sharesState(validatorId || this.validatorId)
    const stakedFor = await this.stakeManager.totalStakedFor(user || this.user)

    assertBigNumberEquality(sharesState.stakePool.sub(stakedFor), sharesK)
  })
}

export function shouldHaveCorrectTotalStakeShares({ totalShares } = {}) {
  it('should have correct total stake shares in the network', async function() {
    const state = await this.stakeManager.validatorState()
    assertBigNumberEquality(state.shares, totalShares || this.totalShares)
  })
}
