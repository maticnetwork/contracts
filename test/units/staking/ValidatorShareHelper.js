
export async function buyVoucher(validatorContract, amount, delegator) {
  const expectedExchangeRate = await validatorContract.exchangeRate()
  return validatorContract.buyVoucher(amount, +expectedExchangeRate, {
    from: delegator
  })
}

export async function sellVoucher(validatorContract, delegator) {
  const expectedExchangeRate = await validatorContract.exchangeRate()
  return validatorContract.sellVoucher(+expectedExchangeRate, {
    from: delegator
  })
}
