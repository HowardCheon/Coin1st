const { run } = require("hardhat");

async function main() {
  const contractAddress = process.argv[2];
  
  if (!contractAddress) {
    console.error("❌ Please provide contract address as argument");
    console.log("Usage: npx hardhat run scripts/verify.js --network sepolia [CONTRACT_ADDRESS]");
    process.exit(1);
  }

  console.log("🔍 Verifying StableCoin contract...");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);

  // Contract constructor parameters (must match deployment)
  const TOKEN_NAME = "StableCoin";
  const TOKEN_SYMBOL = "STABLE";
  const INITIAL_SUPPLY = 1000000;

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY],
      contract: "contracts/StableCoin.sol:StableCoin"
    });

    console.log("✅ Contract verified successfully!");
    console.log(`🔗 View on Etherscan: https://${hre.network.name === 'mainnet' ? '' : hre.network.name + '.'}etherscan.io/address/${contractAddress}`);

  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("ℹ️  Contract is already verified!");
      console.log(`🔗 View on Etherscan: https://${hre.network.name === 'mainnet' ? '' : hre.network.name + '.'}etherscan.io/address/${contractAddress}`);
    } else {
      console.error("❌ Verification failed:");
      console.error(error);
      process.exit(1);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });