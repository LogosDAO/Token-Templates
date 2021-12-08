import { ethers } from 'hardhat'
import { solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { Erc721TierNt } from '../src/types/Erc721TierNt'
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

const testRoot = '0xcfe8da5c0c808f5a1ce988f5a43b2a0ea752a7c0c091a2a828b9a7445c931507'

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
    const memberNftAbstract = (await MemberNft.deploy('test', 'TEST')) as Erc721TierNt
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

    describe('root', function () {
      it('Allows owner to set merkle root', async function () {
        await memberNft.setRoot(testRoot)
        expect(await memberNft.root()).to.equal(testRoot)
      })

      it('Does not allow anyone else to set root', async function () {
        expect(memberNftAsAnyone.setRoot(testRoot)).to.be.revertedWith('!owner')
      })
    })
  })
})
