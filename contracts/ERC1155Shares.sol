// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

/// @title ERC1155Membership
/// @dev ERC1155 contract with:
///         Minting, burning by authorized address
///         Non transferable by default
///
contract ERC1155Shares is ERC1155, Ownable {
    string public contractURI; /*contractURI contract metadata json*/

    mapping(uint256 => uint256) public tokenTier; /* Track the membership tier for each token ID*/
    mapping(uint256 => string) public tierUri; /* Set URI for each token tier */

    mapping(uint256 => address) public tokenAdmins; /* Set admin for each token ID - generally the DAO's safe*/
    mapping(uint256 => bool) public transfersEnabled;

    /// @dev Construtor sets the token and contract URIs
    constructor(string memory uri_, string memory _contractURI) ERC1155(uri_) {
        contractURI = _contractURI;
    }

    /*****************
    Admin Configuration
    *****************/
    /// @notice Set admin for a specific token ID
    /// @param _tokenId Token ID for new admin
    /// @param _admin Address of admin
    function setTokenAdmin(uint256 _tokenId, address _admin) external {
        // Contract owner can set the admin. Admin can also transfer control to a new admin
        require(
            owner() == msg.sender || tokenAdmins[_tokenId] == msg.sender,
            "!owner or admin"
        );
        require(tokenAdmins[_tokenId] != _admin, "already admin");
        tokenAdmins[_tokenId] = _admin;
    }

    function setTransfersEnabled(uint256 _tokenId, bool _transfersEnabled)
        external
    {
        require(tokenAdmins[_tokenId] == msg.sender, "!admin");
        require(transfersEnabled[_tokenId] != _transfersEnabled, "already set");
        transfersEnabled[_tokenId] = _transfersEnabled;
    }

    // @dev Set the URI
    function setURI(string memory uri_) external onlyOwner {
        _setURI(uri_);
    }

    /// @notice Set new contract URI
    /// @param _contractURI Contract metadata json
    function setContractURI(string memory _contractURI) external onlyOwner {
        contractURI = _contractURI;
    }

    /*****************
    Permissioned Minting & Burning
    *****************/
    /// @dev Mint the token for specified id by authorized minter contract or EOA
    function mintToken(
        address _dst,
        uint256 _tokenId,
        uint256 _amount
    ) external {
        require(tokenAdmins[_tokenId] == msg.sender, "!admin");

        _mint(_dst, _tokenId, _amount, "");
    }

    /// @dev Burn a specified number of tokens held by an address
    function burnTokens(
        address _holder,
        uint256 _tokenId,
        uint256 _amount
    ) external {
        require(
            tokenAdmins[_tokenId] == msg.sender,
            "ERC1155Shares#burnTokens: NOT_ADMIN"
        );

        _burn(_holder, _tokenId, _amount);
    }

    /*****************
    Public interfaces
    *****************/
    ///@dev Support interfaces for ERC1155
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155)
        returns (bool)
    {
        // console.log("ERC1155 Interface %s", type(IERC1155).interfaceId);
        // console.log("ERC1155MD Interface %s", type(IERC1155MetadataURI).interfaceId);
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /*****************
    Hooks and internal utils
    *****************/
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155) {
        for (uint256 _i = 0; _i < ids.length; _i++) {
            // Only allow mint, burning unless transfers are enabled
            require(
                to == address(0) ||
                    from == address(0) ||
                    transfersEnabled[ids[_i]],
                "!burn or mint or transfers not enabled"
            );
        }
    }
}
