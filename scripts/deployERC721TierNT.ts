const { ethers } = require('hardhat')
import { Erc721TierNt } from '../src/types/Erc721TierNt'


async function main() {

  const MemberNft = await ethers.getContractFactory('ERC721TierNT')
  
  const uri = 'https://minty-dev-assets.s3.amazonaws.com/tiers/1.json'

  const memberNft = (await MemberNft.deploy('member', 'MEMBER', false)) as Erc721TierNt
  
  await memberNft.setTierURI(1, uri)
  
  console.log({memberNft})
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
