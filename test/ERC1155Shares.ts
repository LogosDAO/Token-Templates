import { ethers } from 'hardhat'
import { solidity } from 'ethereum-waffle'
import { use, expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { makeInterfaceId } from '@openzeppelin/test-helpers'

import { Erc1155Shares } from '../src/types/Erc1155Shares'
import { ContractFactory } from '@ethersproject/contracts'

use(solidity)

// chai
//   .use(require('chai-as-promised'))
//   .should();

const zeroAddress = '0x0000000000000000000000000000000000000000'

const revertMessages = {
  onlyOwner: 'Ownable: caller is not the owner',
  burnNotAdmin: 'ERC1155Shares#burnTokens: NOT_ADMIN',
  setTransferNotAdmin: '!admin',
  transfersDisabled: '!burn or mint or transfers not enabled',
  redundantTransferEnable: 'already set',
  redundantAdminChange: 'already admin',
}

describe.only('ERC1155 Shares', function () {
  let shareNft: Erc1155Shares
  let shareNftAsMinter: Erc1155Shares
  let shareNftAsAnyone: Erc1155Shares

  let deployer: SignerWithAddress
  let minter: SignerWithAddress
  let anyone: SignerWithAddress

  let MemberNft: ContractFactory

  const config = {
    uri: 'https://token-cdn-domain/{id}.json',
    contractUri: 'https://token-cdn-domain/contract.json',
  }

  this.beforeAll(async function () {
    ;[deployer, minter, anyone] = await ethers.getSigners()
    MemberNft = await ethers.getContractFactory('ERC1155Shares')
  })

  beforeEach(async function () {
    const shareNftAbstract = (await MemberNft.deploy(config.uri, config.contractUri)) as Erc1155Shares
    shareNft = await shareNftAbstract.connect(deployer)
    shareNftAsMinter = await shareNftAbstract.connect(minter)
    shareNftAsAnyone = await shareNftAbstract.connect(anyone)

    await shareNft.setTokenAdmin(1, minter.address)
  })

  describe('configuration', function () {
    // it('verify deployment parameters', async function () {})
    describe('Access Control', function () {
      // owner
      it('Allows owner to set token admins', async function () {
        await shareNft.setTokenAdmin(1, anyone.address)
        expect(await shareNft.tokenAdmins(1)).to.equal(anyone.address)
      })

      it('Does not allow non owner or admin to change admin', async function () {
        expect(shareNftAsAnyone.setTokenAdmin(1, anyone.address)).to.be.revertedWith('!owner or admin')
      })

      it('Does not allow redundant state change tx', async function () {
        await shareNft.setTokenAdmin(1, anyone.address)
        expect(shareNft.setTokenAdmin(1, anyone.address)).to.be.revertedWith(revertMessages.redundantAdminChange)
      })

      it('Allows token admin to change admin', async function () {
        await shareNft.setTokenAdmin(1, anyone.address)
        await shareNftAsAnyone.setTokenAdmin(1, deployer.address)
        expect(await shareNft.tokenAdmins(1)).to.equal(deployer.address)
      })

      it('Allows owner to claim token admin for any token', async function () {
        await shareNft.setTokenAdmin(1, anyone.address)
        await shareNft.setTokenAdmin(1, deployer.address)
        expect(await shareNft.tokenAdmins(1)).to.equal(deployer.address)
      })

      it('Allows owner to set uri', async function () {
        expect(await shareNft.uri(1)).to.equal(config.uri)
        await shareNft.setURI('newUri')
        expect(await shareNft.uri(1)).to.equal('newUri')
      })

      it('Allows owner to set contract uri', async function () {
        expect(await shareNft.contractURI()).to.equal(config.contractUri)
        await shareNft.setContractURI('newContractUri')
        expect(await shareNft.contractURI()).to.equal('newContractUri')
      })

      it('Does not allow anyone else to set uri', async function () {
        expect(shareNftAsAnyone.setURI('newUri')).to.be.revertedWith(revertMessages.onlyOwner)
      })

      it('Does not allow anyone else to set contract URI', async function () {
        expect(shareNftAsAnyone.setContractURI('newContractUri')).to.be.revertedWith(revertMessages.onlyOwner)
      })
    })

    describe('Interfaces', function () {
      // token URI
      it('Returns the token URI for the contract', async function () {
        const uri = await shareNft.uri(1)
        expect(uri).to.equal(config.uri)
      })

      it('Returns the token URI for the contract even for non existent tokens', async function () {
        const uri = await shareNft.uri(2)
        expect(uri).to.equal(config.uri)
      })

      // contract URI
      it('Supports interface', async function () {
        const erc1155InterfaceId = makeInterfaceId.ERC165([
          'balanceOf(address,uint256)',
          'balanceOfBatch(address[],uint256[])',
          'isApprovedForAll(address,address)',
          'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
          'safeTransferFrom(address,address,uint256,uint256,bytes)',
          'setApprovalForAll(address,bool)',
        ])
        const erc1155UriInterfaceId = makeInterfaceId.ERC165([
          'uri(uint256)'
        ])
        expect(await shareNft.supportsInterface(erc1155InterfaceId)).to.equal(true)
        expect(await shareNft.supportsInterface(erc1155UriInterfaceId)).to.equal(true)
      })
    })
  })

  describe('Token mint & burn & transfer', function () {
    describe('Burn tokens', function () {
      it('Allows admin to mint tokens for their id', async function () {
        await shareNftAsMinter.mintToken(anyone.address, 1, 10)
        expect(await shareNft.balanceOf(anyone.address, 1)).to.equal(10)
      })

      it('Does not allow anyone else to mint tokens for an ID', async function () {
        expect(shareNftAsAnyone.mintToken(anyone.address, 1, 10)).to.be.revertedWith('!admin')
      })
    })

    describe('Burn tokens', function () {
      it('Allows admin to burn tokens for their id', async function () {
        await shareNftAsMinter.mintToken(anyone.address, 1, 10)
        expect(await shareNft.balanceOf(anyone.address, 1)).to.equal(10)
        await shareNftAsMinter.burnTokens(anyone.address, 1, 10)
        expect(await shareNft.balanceOf(anyone.address, 1)).to.equal(0)
      })

      it('Does not allow anyone else to burn tokens for an ID', async function () {
        await shareNftAsMinter.mintToken(anyone.address, 1, 10)
        expect(shareNftAsAnyone.burnTokens(anyone.address, 1, 10)).to.be.revertedWith(revertMessages.burnNotAdmin)
      })
    })

    describe('Transfer tokens', function () {
      it('Does not allow tokens to be transfered by default', async function () {
        await shareNftAsMinter.mintToken(anyone.address, 1, 10)
        expect(shareNftAsAnyone.safeTransferFrom(anyone.address, deployer.address, 1, 5, [])).to.be.revertedWith(revertMessages.transfersDisabled)
      })

      it('Allows admin to enable token transfers', async function () {
        await shareNftAsMinter.mintToken(anyone.address, 1, 10)
        await shareNftAsMinter.setTransfersEnabled(1, true)
        await shareNftAsAnyone.safeTransferFrom(anyone.address, deployer.address, 1, 5, [])
        expect(await shareNft.balanceOf(anyone.address, 1)).to.equal(5)
        expect(await shareNft.balanceOf(deployer.address, 1)).to.equal(5)
      })

      it('Does not allow anyone else to enable token transfers', async function () {
        expect(shareNftAsAnyone.setTransfersEnabled(1, true)).to.be.revertedWith(revertMessages.setTransferNotAdmin)
      })

      it('Does not allow redundant state change tx', async function () {
        await shareNftAsMinter.mintToken(anyone.address, 1, 10)
        await shareNftAsMinter.setTransfersEnabled(1, true)
        expect(shareNftAsMinter.setTransfersEnabled(1, true)).to.be.revertedWith(revertMessages.redundantTransferEnable)
      })

    })
  })
})
