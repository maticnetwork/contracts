
export async function buyVoucher(validatorContract, amount, delegator, minSharesToMint) {
  return validatorContract.buyVoucher(amount, minSharesToMint || 0, {
    from: delegator
  })
}

export async function sellVoucher(validatorContract, delegator, minClaimAmount, maxShares) {
  if (maxShares === undefined) {
    maxShares = await validatorContract.balanceOf(delegator)
  }

  if (minClaimAmount === undefined) {
    minClaimAmount = await validatorContract.amountStaked(delegator)
  }

  return validatorContract.sellVoucher(minClaimAmount, maxShares, {
    from: delegator
  })
}


export async function sellVoucherNew(validatorContract, delegator, minClaimAmount, maxShares) {
  if (maxShares === undefined) {
    maxShares = await validatorContract.balanceOf(delegator)
  }

  if (minClaimAmount === undefined) {
    minClaimAmount = await validatorContract.amountStaked(delegator)
  }

  return validatorContract.sellVoucher_new(minClaimAmount, maxShares, {
    from: delegator
  })
}
