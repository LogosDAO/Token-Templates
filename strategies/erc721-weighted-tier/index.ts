import { BigNumberish } from '@ethersproject/bignumber'
import { Multicaller, multicall } from '../../utils'

export const author = 'isaacpatka'
export const version = '0.0.1'

const abi = [
  'function balanceOf(address account) external view returns (uint256)',
  'function tokenTier(uint256) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
]

interface IOptions {
  weights: { [key: string]: number }
  address: string
}

async function fetchOwnerBalancesByTier(network, provider, blockTag, contractAddr: string, address: string, balance: number): Promise<{address: string, balances: {[key: number]: number}}> {
  const tokenIds = await multicall(
    network,
    provider,
    abi,
    Array.from({length: balance}, (_, i) => [contractAddr, 'tokenOfOwnerByIndex', [address, i]]),
    { blockTag }
  ) as BigNumberish[]
  
  const tokenTiers = await multicall(
    network,
    provider,
    abi,
    tokenIds.map((value) => [contractAddr, 'tokenTier', [parseInt(value.toString())]]) ,
    { blockTag }
  ) as BigNumberish[]
  
  const response = {}
  
  tokenTiers.forEach((value) => {
    const key = parseInt(value.toString())
    if (!response[key]) response[key] = 1
    else response[key]++
  })
  
  return {
    address,
    balances: response
  }
}

function applyWeight(tierBalances: {[key: number]: number}, weights: {[key: number]: number}): number {
  let weightedBalance = 0
  Object.entries(tierBalances).forEach(([key, balance]) => {
    if (weights[key]) weightedBalance += (weights[key] * balance)
  })
  return weightedBalance
}

export async function strategy(space, network, provider, addresses, options: IOptions, snapshot): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest'

  const balancesMulti = new Multicaller(network, provider, abi, { blockTag })

  addresses.forEach((address) => balancesMulti.call(address, options.address, 'balanceOf', [address]))

  const balances: Record<string, BigNumberish> = await balancesMulti.execute()
  
  const tierBalancePromises: Promise<{address: string, balances: {[key: number]: number}}>[] = []
  
  Object.entries(balances).forEach(([address, balance]) =>
  tierBalancePromises.push(
      fetchOwnerBalancesByTier(network, provider, blockTag, options.address, address, parseInt(balance.toString()))
  ))
  
  const response: Record<string, number> = {}
  
  return await Promise.all(tierBalancePromises)
    .then((tierBalances) => {
      tierBalances.forEach((tb) => {
        const weighted = applyWeight(tb.balances, options.weights);
        response[tb.address] = weighted
      });

      return response;
    })

}
