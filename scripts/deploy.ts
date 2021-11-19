const { ethers } = require('hardhat')
import { Erc1155Shares } from '../src/types/Erc1155Shares'


async function main() {

  const MemberNft = await ethers.getContractFactory('ERC1155Shares')
  
  const uri = 'https://minty-dev-assets.s3.amazonaws.com/shares/{id}.json'

  const memberNft = (await MemberNft.deploy(uri)) as Erc1155Shares
  
  await memberNft.setTokenAdmin(1, '0x744222844bFeCC77156297a6427B5876A6769e19')
  
  console.log({memberNft})
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
