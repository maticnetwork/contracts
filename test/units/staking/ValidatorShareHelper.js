
export async function buyVoucher(validatorContract, amount, delegator) {
  return validatorContract.buyVoucher(amount, 0 /* minSharesToMint */, {
    from: delegator
  })
}

export async function sellVoucher(validatorContract, delegator) {
  const expectedExchangeRate = await validatorContract.exchangeRate()
  return validatorContract.sellVoucher(0 /* minClaimAmount */, {
    from: delegator
  })
}
