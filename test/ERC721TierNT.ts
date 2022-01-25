import { ethers } from 'hardhat'
import { solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { Erc721TierNt } from '../src/types/Erc721TierNt'
import { NtConsumer } from '../src/types/NtConsumer'
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

const testKey = '0xdd631135f3a99e4d747d763ab5ead2f2340a69d2a90fab05e20104731365fde3'

async function blockTime() {
  const block = await ethers.provider.getBlock('latest')
  return block.timestamp
}

describe.only('ERC721 Membership Tiers', function () {
  let memberNft: Erc721TierNt
  let memberNftAsMinter: Erc721TierNt
  let memberNftAsAnyone: Erc721TierNt

  let deployer: SignerWithAddress
  let minter: SignerWithAddress
  let anyone: SignerWithAddress

  let author: Wallet

  let MemberNft: ContractFactory

  this.beforeAll(async function () {
    ;[deployer, minter, anyone] = await ethers.getSigners()

    const adminAbstract = new ethers.Wallet(testKey)
    const provider = ethers.provider
    author = await adminAbstract.connect(provider)

    await deployer.sendTransaction({ to: author.address, value: ethers.utils.parseEther('10') })
    MemberNft = await ethers.getContractFactory('ERC721TierNT')
  })

  beforeEach(async function () {
    const memberNftAbstract = (await MemberNft.deploy('test', 'TEST', false)) as Erc721TierNt
    memberNft = await memberNftAbstract.connect(deployer)
    memberNftAsMinter = await memberNftAbstract.connect(minter)
    memberNftAsAnyone = await memberNftAbstract.connect(anyone)

    await memberNft.grantRole(minterRole, minter.address)
    await memberNft.grantRole(minterRole, author.address)
  })

  describe('minting', function () {
    // it('verify deployment parameters', async function () {})

    describe('mint tier admin', function () {
      it('Allows minter to mint a token tier', async function () {
        await memberNftAsMinter.mintTierAdmin(1, anyone.address)
        expect(await memberNft.balanceOf(anyone.address)).to.equal(1)
      })
    })

    describe('mint tier with signature', function () {
      it('Allows minter to mint a token tier', async function () {
        const msgHash = ethers.utils.hashMessage(
          ethers.utils.arrayify(ethers.utils.solidityKeccak256(['uint256', 'address', 'address'], [1, anyone.address, memberNft.address]))
        )
        const sig = await author.signMessage(msgHash)
        await memberNftAsAnyone.mintTier(1, anyone.address, 1, sig, author.address)
        expect(await memberNft.balanceOf(anyone.address)).to.equal(1)
      })

      it('Fails if sig used twice', async function () {
        const msgHash = ethers.utils.hashMessage(
          ethers.utils.arrayify(ethers.utils.solidityKeccak256(['uint256', 'address', 'address'], [1, anyone.address, memberNft.address]))
        )
        const sig = await author.signMessage(msgHash)
        await memberNftAsAnyone.mintTier(1, anyone.address, 1, sig, author.address)
        expect(memberNftAsAnyone.mintTier(1, anyone.address, 1, sig, author.address)).to.be.revertedWith('signature already used')
      })

      it('Fails if signer not authorized', async function () {
        const msgHash = ethers.utils.hashMessage(
          ethers.utils.arrayify(ethers.utils.solidityKeccak256(['uint256', 'address', 'address'], [1, anyone.address, memberNft.address]))
        )
        const sig = await author.signMessage(msgHash)
        await memberNft.revokeRole(minterRole, author.address)
        expect(memberNftAsAnyone.mintTier(1, anyone.address, 1, sig, author.address)).to.be.revertedWith('!minter')
      })
    })
    describe('no transfers', function () {
      it('Does not allow tokens ot be transfered', async function () {
        await memberNftAsMinter.mintTierAdmin(1, anyone.address)
        expect(memberNftAsAnyone.transferFrom(anyone.address, author.address, 1)).to.be.revertedWith('!transfer')
      })
    })

    describe('transferability', function () {
      it('Allows transferability if set on deploy', async function () {
        const memberNftAbstract = (await MemberNft.deploy('test', 'TEST', true)) as Erc721TierNt
        memberNft = await memberNftAbstract.connect(deployer)
        await memberNft.mintTierAdmin(1, deployer.address)
        expect(await memberNft.ownerOf(1)).to.equal(deployer.address)
        await memberNft.transferFrom(deployer.address, anyone.address, 1)
        expect(await memberNft.ownerOf(1)).to.equal(anyone.address)
      })
    })
  })
})

describe.only('ERC721 Membership Tiers Consumer', function () {
  let memberNft: Erc721TierNt
  let consumer: NtConsumer

  let consumerAsHolder: NtConsumer

  let deployer: SignerWithAddress
  let minter: SignerWithAddress
  let holder: SignerWithAddress

  let author: Wallet

  let MemberNft: ContractFactory
  let Consumer: ContractFactory

  this.beforeAll(async function () {
    ;[deployer, minter, holder] = await ethers.getSigners()

    const adminAbstract = new ethers.Wallet(testKey)
    const provider = ethers.provider
    author = await adminAbstract.connect(provider)

    await deployer.sendTransaction({ to: author.address, value: ethers.utils.parseEther('10') })
    MemberNft = await ethers.getContractFactory('ERC721TierNT')
    Consumer = await ethers.getContractFactory('NTConsumer')
  })

  beforeEach(async function () {
    const memberNftAbstract = (await MemberNft.deploy('test', 'TEST', false)) as Erc721TierNt
    memberNft = await memberNftAbstract.connect(deployer)

    await memberNft.grantRole(minterRole, minter.address)
    await memberNft.grantRole(minterRole, author.address)

    consumer = (await Consumer.deploy(author.address, memberNft.address)) as NtConsumer
    consumerAsHolder = await consumer.connect(holder)
  })

  describe('validating', function () {
    // it('verify deployment parameters', async function () {})

    describe('consumer', function () {
      it('Allows holder to access function that requires validation', async function () {
        await memberNft.mintTierAdmin(1, holder.address)
        expect(await memberNft.balanceOf(holder.address)).to.equal(1)

        const currBlockTime = await blockTime()

        const expiration = currBlockTime + 1000
        console.log({ currBlockTime, expiration, address: memberNft.address})

        const msgHash = ethers.utils.hashMessage(
          ethers.utils.arrayify(ethers.utils.solidityKeccak256(['address', 'uint256', 'uint256'], [memberNft.address, 1, expiration]))
        )
        const sig = await author.signMessage(msgHash)

        expect(await consumerAsHolder.protectedUpdate(100, 1, expiration, sig)).to.be.true
      })
    })
  })
})
