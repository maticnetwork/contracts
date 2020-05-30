
export async function buyVoucher(validatorContract, amount, delegator, minSharesToMint) {
  return validatorContract.buyVoucher(amount, minSharesToMint || 0, {
    from: delegator
  })
}

export async function sellVoucher(validatorContract, delegator, minClaimAmount) {
  return validatorContract.sellVoucher(minClaimAmount || 0, {
    from: delegator
  })
}
