// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

interface IERC721MembershipTier {
    function mintTier(uint256 _tier, address _dst) external;
}

/// @title ERC721MembershipTier
/// @dev ERC721 contract with additional data for membership tiers
///
///  Features in this version
///
///     ERC721 contract with:
///         Minting by authorized contract - Separate sale contract or avatar
///
contract ERC721MembershipTier is ERC721Enumerable, AccessControl, IERC721MembershipTier {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    mapping(uint256 => uint256) public tokenTier; /* Track the membership tier for each token ID*/
    mapping(uint256 => string) public tierUri; /* Set URI for each token tier */

    /// @dev Construtor sets the token metadata and the roles
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
    {
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(OWNER_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /*****************
    Permissioned Minting
    *****************/
    /// @dev Mint the token for specified tier by authorized minter contract or EOA
    function mintTier(uint256 _tier, address _dst) external override {
        require(hasRole(MINTER_ROLE, msg.sender), "!minter");
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

    ///@dev Accounting function useful for using NFTs in voting
    function balanceByTier(address _owner, uint256[] memory _tiers) public view returns (uint256[] memory) {
        uint256 _ownerBalance = balanceOf(_owner);
        uint256[] memory _ownerTokenIds = new uint256[](_ownerBalance);

        for (uint256 _i = 0; _i < _ownerBalance; _i++) {
            _ownerTokenIds[_i] = tokenOfOwnerByIndex(_owner, _i);
        }

        uint256[] memory _tierBalances = new uint256[](_tiers.length);

        for (uint256 _i = 0; _i < _ownerBalance; _i++) {
            for (uint256 _j = 0; _j < _tiers.length; _j++) {
                if (tokenTier[_ownerTokenIds[_i]] == _tiers[_j]) {
                    _tierBalances[_j]++;
                }
            }
        }

        return _tierBalances;
    }
}
