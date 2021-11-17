const { ethers } = require('hardhat')

import { Erc721MembershipTier } from '../src/types/Erc721MembershipTier'

async function main() {

  const MemberNft = await ethers.getContractFactory('ERC721MembershipTier')

  const memberNft = (await MemberNft.deploy('test', 'TEST')) as Erc721MembershipTier
  
  console.log({memberNft})
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
