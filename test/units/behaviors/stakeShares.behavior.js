import { assertBigNumberEquality } from '../../helpers/utils'

export function shouldHaveCorrectStake({ shares, validatorId, user }) {
  it('must have correct shares', async function() {
    const sharesK = await this.stakeManager.sharesK()
    const sharesPrecision = await this.stakeManager.SHARES_PRECISION()

    const sharesState = await this.stakeManager.sharesState(validatorId)
    console.log('sharesState.shares', sharesState.shares.toString())
    console.log('sharesState.sharesPool', sharesState.sharesPool.toString())
    console.log('sharesState.stakePool', sharesState.stakePool.toString())
    console.log('shares', shares)
    assertBigNumberEquality(shares, sharesState.shares)
    console.log('sharesK', sharesK)
    assertBigNumberEquality(sharesState.shares.add(sharesState.sharesPool), sharesK)

    const stakedFor = await this.stakeManager.totalStakedFor(user)
    assertBigNumberEquality(sharesState.stakePool.sub(stakedFor.mul(sharesPrecision)), sharesK)
  })
}
