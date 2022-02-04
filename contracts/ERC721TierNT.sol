// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

interface IERC721TierNT {
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

/// @title ERC721TierNT
/// @dev Non-transferable ERC721 contract with additional data for membership tiers
///
///  Features in this version
///
///     Admins can directly mint or give signatures to users to mint
///
contract ERC721TierNT is ERC721Enumerable, AccessControl {
    using ECDSA for bytes32; /*ECDSA for signature recovery for license mints*/
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    mapping(uint256 => uint256) public tokenTier; /* Track the membership tier for each token ID*/
    mapping(uint256 => string) public tierUri; /* Set URI for each token tier */
    mapping(bytes32 => bool) public signatureUsed; /* track if consent signature has been used */

    bool public transferable; /* Store if NFTs should be transferable or not*/

    /// @dev Construtor sets the token metadata and the roles
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    constructor(
        string memory name_,
        string memory symbol_,
        bool _transferable
    ) ERC721(name_, symbol_) {
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(OWNER_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        transferable = _transferable;
    }

    /*****************
    Permissioned Minting
    *****************/
    /// @dev Mint the token for specified tier using a signature from an authorized minter
    function mintTier(
        uint256 _tier,
        address _dst,
        uint256 _nonce,
        bytes memory _signature,
        address _minter
    ) external {
        require(hasRole(MINTER_ROLE, _minter), "!minter");
        bytes32 _digest = keccak256(
            abi.encodePacked(_nonce, _dst, address(this))
        );
        require(!signatureUsed[_digest], "signature already used");
        signatureUsed[_digest] = true; /*Mark signature as used so we cannot use it again*/
        require(_verify(_digest, _signature, _minter)); // verify auth was signed by owner of token ID 1
        _mintTier(_tier, _dst);
    }

    /// @dev Mint the token for specified tier by authorized minter contract or EOA
    function mintTierAdmin(uint256 _tier, address _dst) external {
        require(hasRole(MINTER_ROLE, msg.sender), "!minter");
        _mintTier(_tier, _dst);
    }

    /// @dev Internal util for minting
    function _mintTier(uint256 _tier, address _dst) internal {
        _tokenIds.increment();

        uint256 _id = _tokenIds.current();

        tokenTier[_id] = _tier;

        _safeMint(_dst, _id);
    }

    // @dev Set the URI for this token tier
    function setTierURI(uint256 _tier, string memory _uri) external {
        require(hasRole(OWNER_ROLE, msg.sender), "!owner");
        tierUri[_tier] = _uri;
    }

    /*****************
    Public interfaces
    *****************/
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(_tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        return tierUri[tokenTier[_tokenId]];
    }

    ///@dev Support interfaces for Access Control and ERC721
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC721Enumerable)
        returns (bool)
    {
        return
            interfaceId == type(IERC721Enumerable).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// @dev Internal util to confirm license signatures
    /// @param data Message hash
    /// @param signature Sig from primary token holder
    /// @param account address to compare with recovery
    function _verify(
        bytes32 data,
        bytes memory signature,
        address account
    ) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == account;
    }

    /// @dev Internal hook to disable all transfers
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721Enumerable) {
        require(
            to == address(0) || from == address(0) || transferable,
            "!transfer"
        );
    }
}
