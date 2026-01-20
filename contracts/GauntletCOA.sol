// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================================
// GAUNTLET GALLERY - CERTIFICATE OF AUTHENTICITY NFT CONTRACT
// ============================================================================
//
// This contract implements an ERC-721 NFT system for artwork authentication.
// Each NFT represents a verified Certificate of Authenticity (COA) for a
// physical artwork, providing immutable proof of authenticity on the
// Polygon blockchain.
//
// Key Features:
// - Unique COA codes mapped to NFT token IDs
// - Owner-only minting for security
// - Batch minting for efficiency
// - Metadata URI storage for artwork details
//
// Deployed: Polygon Mainnet
// Address: 0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1
// ============================================================================

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GauntletCOA
 * @author John Shay
 * @notice NFT Certificate of Authenticity for Gauntlet Gallery artwork
 * @dev Extends ERC721 with URI storage and ownership controls
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        GauntletCOA                              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  ERC721           - Standard NFT functionality                  │
 * │  ERC721URIStorage - Store metadata URI per token                │
 * │  Ownable          - Restrict minting to contract owner          │
 * └─────────────────────────────────────────────────────────────────┘
 */
contract GauntletCOA is ERC721, ERC721URIStorage, Ownable {

    // ========================================================================
    // STATE VARIABLES
    // ========================================================================

    /**
     * @dev Counter for generating unique token IDs
     * Starts at 0, incremented before each mint (first token = 1)
     */
    uint256 private _nextTokenId;

    /**
     * @dev Maps COA codes to their corresponding token IDs
     * Example: "290745" => 1
     *
     * Used for:
     * - Checking if a COA has been minted (value != 0)
     * - Looking up token ID from COA code
     */
    mapping(string => uint256) public coaCodeToTokenId;

    /**
     * @dev Maps token IDs back to their COA codes
     * Example: 1 => "290745"
     *
     * Used for:
     * - Retrieving COA code when only token ID is known
     * - Display purposes in wallets/marketplaces
     */
    mapping(uint256 => string) public tokenIdToCoaCode;

    // ========================================================================
    // EVENTS
    // ========================================================================

    /**
     * @dev Emitted when a new COA NFT is minted
     * @param tokenId The unique token ID of the minted NFT
     * @param coaCode The COA code associated with this certificate
     * @param owner The address that received the NFT
     *
     * Indexed parameters allow efficient filtering in event logs:
     * - Filter by tokenId to track specific certificates
     * - Filter by owner to track all certificates for an address
     */
    event COAMinted(uint256 indexed tokenId, string coaCode, address indexed owner);

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    /**
     * @dev Initializes the contract with name, symbol, and sets deployer as owner
     *
     * Token Details:
     * - Name: "Gauntlet Gallery COA" (displayed in wallets)
     * - Symbol: "GCOA" (ticker symbol)
     *
     * The deployer becomes the contract owner and is the only address
     * authorized to mint new COA NFTs.
     */
    constructor() ERC721("Gauntlet Gallery COA", "GCOA") Ownable(msg.sender) {}

    // ========================================================================
    // MINTING FUNCTIONS
    // ========================================================================

    /**
     * @notice Mint a new COA NFT for a specific artwork
     * @dev Only callable by contract owner. Creates a new NFT linked to a COA code.
     *
     * @param to Address to receive the NFT (typically gallery wallet or collector)
     * @param coaCode Unique identifier matching physical COA sticker (e.g., "290745")
     * @param uri Metadata URI containing artwork details (IPFS or HTTPS)
     * @return tokenId The ID of the newly minted token
     *
     * Requirements:
     * - Caller must be contract owner (gallery admin)
     * - COA code cannot be empty
     * - COA code must not already be minted (prevents duplicates)
     *
     * Example Usage:
     * ```
     * mintCOA(
     *     0x1234...5678,           // Collector's wallet
     *     "290745",                 // Matches physical sticker
     *     "ipfs://Qm.../metadata"   // Artwork metadata
     * );
     * ```
     *
     * Emits: {COAMinted} event with tokenId, coaCode, and owner
     */
    function mintCOA(address to, string memory coaCode, string memory uri) public onlyOwner returns (uint256) {
        // Validate COA code is not empty
        require(bytes(coaCode).length > 0, "COA code cannot be empty");

        // Prevent duplicate minting - each COA code can only have one NFT
        // Note: coaCodeToTokenId returns 0 for unminted codes (default uint256 value)
        require(coaCodeToTokenId[coaCode] == 0, "COA code already minted");

        // Generate new token ID (pre-increment to start at 1, not 0)
        uint256 tokenId = ++_nextTokenId;

        // Mint the NFT to the recipient
        // _safeMint checks if recipient can receive ERC721 tokens
        _safeMint(to, tokenId);

        // Store the metadata URI for this token
        _setTokenURI(tokenId, uri);

        // Create bidirectional mapping between COA code and token ID
        coaCodeToTokenId[coaCode] = tokenId;
        tokenIdToCoaCode[tokenId] = coaCode;

        // Emit event for off-chain tracking and indexing
        emit COAMinted(tokenId, coaCode, to);

        return tokenId;
    }

    /**
     * @notice Batch mint multiple COA NFTs in a single transaction
     * @dev Gas-efficient way to mint many certificates at once
     *
     * @param to Address to receive all NFTs
     * @param coaCodes Array of unique COA codes
     * @param uris Array of metadata URIs (must match coaCodes length)
     *
     * Requirements:
     * - Caller must be contract owner
     * - Arrays must have equal length
     * - All COA codes must be unique and not previously minted
     *
     * Gas Savings:
     * - ~20% cheaper than individual mintCOA calls for 10+ NFTs
     * - Single transaction reduces total gas overhead
     *
     * Example Usage:
     * ```
     * string[] memory codes = ["290756", "290757", "290758"];
     * string[] memory uris = ["ipfs://Qm.../1", "ipfs://Qm.../2", "ipfs://Qm.../3"];
     * batchMintCOA(galleryWallet, codes, uris);
     * ```
     */
    function batchMintCOA(address to, string[] memory coaCodes, string[] memory uris) public onlyOwner {
        // Validate array lengths match
        require(coaCodes.length == uris.length, "Arrays must match");

        // Iterate and mint each COA
        // Note: Uses mintCOA internally, which includes all validations
        for (uint256 i = 0; i < coaCodes.length; i++) {
            mintCOA(to, coaCodes[i], uris[i]);
        }
    }

    // ========================================================================
    // VIEW FUNCTIONS (Read-only, no gas cost when called externally)
    // ========================================================================

    /**
     * @notice Check if a COA code has already been minted as an NFT
     * @param coaCode The COA code to check
     * @return bool True if minted, false otherwise
     *
     * Use Cases:
     * - Verify certificate authenticity in web app
     * - Prevent duplicate minting attempts
     * - Check if sticker code is registered
     */
    function isCoaMinted(string memory coaCode) public view returns (bool) {
        // Token IDs start at 1, so 0 means not minted
        return coaCodeToTokenId[coaCode] != 0;
    }

    /**
     * @notice Get the token ID associated with a COA code
     * @param coaCode The COA code to look up
     * @return uint256 The token ID
     *
     * @dev Reverts if COA code has not been minted
     *
     * Use Cases:
     * - Retrieve token ID for marketplace listings
     * - Look up token for transfer operations
     */
    function getTokenIdByCoaCode(string memory coaCode) public view returns (uint256) {
        require(coaCodeToTokenId[coaCode] != 0, "COA not found");
        return coaCodeToTokenId[coaCode];
    }

    /**
     * @notice Get the current owner of a COA by its code
     * @param coaCode The COA code
     * @return address The owner's wallet address
     *
     * @dev Reverts if COA code has not been minted
     *
     * Use Cases:
     * - Display current owner in verification UI
     * - Verify collector ownership claims
     */
    function getCoaOwner(string memory coaCode) public view returns (address) {
        uint256 tokenId = getTokenIdByCoaCode(coaCode);
        return ownerOf(tokenId);
    }

    // ========================================================================
    // REQUIRED OVERRIDES
    // ========================================================================

    /**
     * @notice Get the metadata URI for a token
     * @dev Override required due to multiple inheritance (ERC721 + ERC721URIStorage)
     * @param tokenId The token ID to query
     * @return string The metadata URI
     *
     * Returns the URI set during minting, typically pointing to:
     * - IPFS: "ipfs://QmXxx.../metadata.json"
     * - HTTPS: "https://api.example.com/metadata/123"
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Check if contract supports a given interface
     * @dev Override required due to multiple inheritance
     * @param interfaceId The interface identifier to check
     * @return bool True if interface is supported
     *
     * Supports:
     * - ERC721: 0x80ac58cd
     * - ERC721Metadata: 0x5b5e139f
     * - ERC165: 0x01ffc9a7
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
