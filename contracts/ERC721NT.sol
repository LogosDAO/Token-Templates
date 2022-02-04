// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "hardhat/console.sol";

interface IERC721NT {
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

/// @title ERC721NT
/// @dev Non-transferable ERC721 contract
///
///  Features in this version
///
///     Admins can directly mint or give signatures to users to mint
///
contract ERC721NT is ERC721Enumerable, AccessControl {
    using ECDSA for bytes32; /*ECDSA for signature recovery for license mints*/
    using Strings for uint256;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    string public baseURI; /*baseURI_ String to prepend to token IDs*/

    mapping(bytes32 => bool) public signatureUsed; /* track if authorization signature has been used */

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
    /// @dev Mint the token for using a signature from an authorized minter
    function mint(uint256 _nonce, bytes memory _signature) external {
        address _dst = msg.sender;
        bytes32 _digest = keccak256(
            abi.encodePacked(_nonce, _dst, address(this))
        );
        require(!signatureUsed[_digest], "signature already used");
        signatureUsed[_digest] = true; /*Mark signature as used so we cannot use it again*/
        require(
            _verify(_digest, _signature, MINTER_ROLE),
            "invalid authorization"
        ); // verify auth was signed by owner of token ID 1
        _mintInternal(_dst);
    }

    /// @dev Mint the token by authorized minter contract or EOA
    function mintAdmin(address _dst) external {
        require(hasRole(MINTER_ROLE, msg.sender), "!minter");
        _mintInternal(_dst);
    }

    /*****************
    Public interfaces
    *****************/
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
                : "";
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

    /*****************
    Config
    *****************/
    /// @notice Set new base URI for token IDs
    /// @param baseURI_ String to prepend to token IDs
    function setBaseURI(string memory baseURI_) external {
        require(hasRole(OWNER_ROLE, msg.sender), "!owner");
        _setBaseURI(baseURI_);
    }

    /*****************
    INTERNAL MINTING FUNCTIONS AND HELPERS
    *****************/
    /// @notice internal helper to retrieve private base URI for token URI construction
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /// @notice internal helper to update token URI
    /// @param baseURI_ String to prepend to token IDs
    function _setBaseURI(string memory baseURI_) internal {
        baseURI = baseURI_;
    }

    /// @dev Internal util for minting
    function _mintInternal(address _dst) internal {
        _tokenIds.increment();

        uint256 _id = _tokenIds.current();

        _safeMint(_dst, _id);
    }

    /// @dev Internal util to confirm seed sig
    /// @param data Message hash
    /// @param signature Sig from primary token holder
    /// @param role Role recovered address should have
    function _verify(
        bytes32 data,
        bytes memory signature,
        bytes32 role
    ) internal view returns (bool) {
        return hasRole(role, data.toEthSignedMessageHash().recover(signature));
    }

    /// @dev Internal hook to disable all transfers
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
        require(
            to == address(0) || from == address(0) || transferable,
            "!transfer"
        );
    }
}

contract NTConsumer {
    using ECDSA for bytes32; /*ECDSA for signature recovery for license mints*/
    address signer;
    IERC721NT tokenContract;

    uint256 public genericState;

    constructor(address _signer, address _tokenContract) {
        signer = _signer;
        tokenContract = IERC721NT(_tokenContract);
    }

    modifier validOnly(
        uint256 _tokenId,
        uint256 _expiration,
        uint256 _tier,
        bytes memory _signature
    ) {
        require(validate(_tokenId, _expiration, _tier, _signature), "Invalid");
        _;
    }

    // GET kycdao.io/signatuers/tokenId

    function validate(
        uint256 _tokenId,
        uint256 _expiration,
        uint256 _tier,
        bytes memory _signature
    ) public returns (bool) {
        require(_expiration > block.timestamp, "Expired");
        require(tokenContract.ownerOf(_tokenId) == msg.sender, "!owner"); /*Sender must hold token*/
        bytes32 _digest = keccak256(
            abi.encodePacked(
                address(tokenContract),
                _tokenId,
                _tier,
                _expiration
            )
        );
        require(_verify(_digest, _signature, signer), "Not signer");

        return true;
    }

    /// @dev Internal util to confirm seed sig
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

    function joinDao(
        uint256 _stateUpdate,
        uint256 _tokenId,
        uint256 _tier,
        uint256 _expiration,
        bytes memory _signature
    )
        public
        validOnly(_tokenId, _expiration, _tier, _signature)
        returns (bool)
    {
        genericState = _stateUpdate;
    }
}
