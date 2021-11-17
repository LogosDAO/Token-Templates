import { ethers } from 'hardhat'
import { solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { Erc721MembershipTier } from '../src/types/Erc721MembershipTier'
import { Wallet } from '@ethersproject/wallet'
import { ContractFactory } from '@ethersproject/contracts'

use(solidity)

// chai
//   .use(require('chai-as-promised'))
//   .should();

const zeroAddress = '0x0000000000000000000000000000000000000000'

const minterRole = ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE'])
const ownerRole = ethers.utils.solidityKeccak256(['string'], ['OWNER_ROLE'])
const adminRole = '0x0000000000000000000000000000000000000000000000000000000000000000'

describe('ERC721 Membership Tiers', function () {
  let memberNft: Erc721MembershipTier
  let memberNftAsMinter: Erc721MembershipTier
  let memberNftAsAnyone: Erc721MembershipTier

  let deployer: SignerWithAddress
  let minter: SignerWithAddress
  let anyone: SignerWithAddress

  let MemberNft: ContractFactory

  this.beforeAll(async function () {
    ;[deployer, minter, anyone] = await ethers.getSigners()
    MemberNft = await ethers.getContractFactory('ERC721MembershipTier')
  })

  beforeEach(async function () {
    const memberNftAbstract = (await MemberNft.deploy('test', 'TEST')) as Erc721MembershipTier
    memberNft = await memberNftAbstract.connect(deployer)
    memberNftAsMinter = await memberNftAbstract.connect(minter)
    memberNftAsAnyone = await memberNftAbstract.connect(anyone)

    await memberNft.grantRole(minterRole, minter.address)
  })

  describe('minting', function () {
    // it('verify deployment parameters', async function () {})

    describe('mint tier', function () {
      it('Allows minter to mint a token tier', async function () {
        await memberNftAsMinter.mintTier(1, anyone.address)
        expect(await memberNft.balanceOf(anyone.address)).to.equal(1)
      })
    })
  })

  describe('interfaces', function () {
    // it('verify deployment parameters', async function () {})

    describe('balance by tier', function () {
      it('Allows external call to check balance of an address by tier', async function () {
        await memberNftAsMinter.mintTier(1, anyone.address)
        await memberNftAsMinter.mintTier(2, anyone.address)
        await memberNftAsMinter.mintTier(1, anyone.address)
        await memberNftAsMinter.mintTier(1, anyone.address)
        
        const expectedTierBalances = [3, 1]

        const tierBalances = await memberNft.balanceByTier(anyone.address, [1,2])
        tierBalances.forEach((value, index) => expect(value).to.equal(expectedTierBalances[index]))
      })
    })
  })
})
