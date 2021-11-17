import { BigNumberish } from '@ethersproject/bignumber';
import { Multicaller} from '../../utils';

export const author = 'isaacpatka';
export const version = '0.0.1';

const abi = [
  'function balanceByTier(address account, uint256[] _tiers) external view returns (uint256[])',
  'function tokenTier(uint256) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)'
];

interface IOptions {
  weights: { [key: string]: number };
  address: string;
}

function applyWeight(
  tierBalances: { [key: number]: number },
  weights: { [key: number]: number }
): number {
  let weightedBalance = 0;
  Object.entries(tierBalances).forEach(([key, balance]) => {
    if (weights[key]) weightedBalance += weights[key] * balance;
  });
  return weightedBalance;
}

export async function strategy(
  space,
  network,
  provider,
  addresses,
  options: IOptions,
  snapshot
): Promise<Record<string, number>> {
  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  
  const tiers = Object.keys(options.weights)

  const balancesMulti = new Multicaller(network, provider, abi, { blockTag });

  addresses.forEach((address) =>
    balancesMulti.call(address, options.address, 'balanceByTier', [
      address,
      tiers
    ])
  );

  const balances: Record<
    string,
    BigNumberish[]
  > = await balancesMulti.execute();

  const response: Record<string, number> = {};

    Object.entries(balances).forEach(([address, balance]) => {
      const tierBalances: { [key: number]: number } = {}
      balance.forEach((bal, index) => tierBalances[tiers[index]] = bal)
      const weighted = applyWeight(tierBalances, options.weights);
      response[address] = weighted;
    })
    
    console.log({response})
    
    return response
}
