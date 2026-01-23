const { ethers } = require("hardhat");

async function main() {
  const CONTRACT_ADDRESS = "0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1";

  // COA to mint
  const coaCode = process.env.COA_CODE || "291045";
  const recipientAddress = process.env.RECIPIENT || (await ethers.provider.getSigner()).address;

  // Metadata URI - you can update this to point to IPFS or your API
  const metadataUri = `https://coa.up.railway.app/api/verify/${coaCode}`;

  console.log("Minting COA NFT...");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("COA Code:", coaCode);
  console.log("Recipient:", recipientAddress);
  console.log("Metadata URI:", metadataUri);

  // Get contract instance
  const GauntletCOA = await ethers.getContractFactory("GauntletCOA");
  const contract = GauntletCOA.attach(CONTRACT_ADDRESS);

  // Check if already minted
  const isMinted = await contract.isCoaMinted(coaCode);
  if (isMinted) {
    console.log("COA already minted!");
    const tokenId = await contract.getTokenIdByCoaCode(coaCode);
    console.log("Token ID:", tokenId.toString());
    return;
  }

  // Mint the COA
  console.log("\nSending transaction...");
  const tx = await contract.mintCOA(recipientAddress, coaCode, metadataUri);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  // Get the token ID
  const tokenId = await contract.getTokenIdByCoaCode(coaCode);
  console.log("\nSuccess! Token ID:", tokenId.toString());
  console.log(`View on Polygonscan: https://polygonscan.com/token/${CONTRACT_ADDRESS}?a=${tokenId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
