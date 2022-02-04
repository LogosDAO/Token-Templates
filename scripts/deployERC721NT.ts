const { ethers } = require('hardhat')
import { Erc721Nt } from '../src/types/Erc721Nt'
import { Erc721NtFactory } from '../src/types/Erc721NtFactory'

async function main() {
  const MemberNft = (await ethers.getContractFactory('ERC721NT')) as Erc721NtFactory

  const uri = 'https://minty-dev-assets.s3.amazonaws.com/nt/'

  const memberNft = (await MemberNft.deploy('member', 'MEMBER', uri, false)) as Erc721Nt

  console.log({ memberNft })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
