export async function buyVoucher(validatorContract, amount, delegator, minSharesToMint) {
  const validatorContract_Delegator = validatorContract.connect(validatorContract.provider.getSigner(delegator))
  return validatorContract_Delegator.buyVoucher(amount.toString(), minSharesToMint || 0)
}

export async function sellVoucher(validatorContract, delegator, minClaimAmount, maxShares) {
  if (maxShares === undefined) {
    maxShares = await validatorContract.balanceOf(delegator)
  }

  if (minClaimAmount === undefined) {
    minClaimAmount = await validatorContract.amountStaked(delegator)
  }

  const validatorContract_Delegator = validatorContract.connect(validatorContract.provider.getSigner(delegator))

  return validatorContract_Delegator.sellVoucher(minClaimAmount, maxShares)
}

export async function sellVoucherNew(validatorContract, delegator, minClaimAmount, maxShares) {
  if (maxShares === undefined) {
    maxShares = await validatorContract.balanceOf(delegator)
  }

  if (minClaimAmount === undefined) {
    minClaimAmount = await validatorContract.amountStaked(delegator)
  }
  const validatorContract_Delegator = validatorContract.connect(validatorContract.provider.getSigner(delegator))

  return validatorContract_Delegator.sellVoucher_new(minClaimAmount.toString(), maxShares)
}
