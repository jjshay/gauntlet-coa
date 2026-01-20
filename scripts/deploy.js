const hre = require("hardhat");

async function main() {
  console.log("Deploying GauntletCOA to Polygon Mainnet...");

  const GauntletCOA = await hre.ethers.getContractFactory("GauntletCOA");
  const contract = await GauntletCOA.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ GauntletCOA deployed successfully!");
  console.log("📍 Contract address:", address);
  console.log("\nView on PolygonScan: https://polygonscan.com/address/" + address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
