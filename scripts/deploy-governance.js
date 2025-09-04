const { ethers } = require("hardhat");

async function main() {
  console.log("🏛️ Starting Governance System Deployment...");
  
  const [deployer, admin, proposer1, proposer2, executor1, executor2] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Admin address:", admin.address);

  // Configuration
  const TOKEN_NAME = "Governed StableCoin";
  const TOKEN_SYMBOL = "GSTABLE";
  const INITIAL_SUPPLY = 1000000; // 1 million tokens
  const TIMELOCK_DELAY = 2 * 24 * 60 * 60; // 2 days
  const MULTISIG_OWNERS = [proposer1.address, proposer2.address, executor1.address];
  const MULTISIG_THRESHOLD = 2; // 2 out of 3 signatures required

  console.log("\n📝 Deployment Configuration:");
  console.log("Token Name:", TOKEN_NAME);
  console.log("Token Symbol:", TOKEN_SYMBOL);
  console.log("Initial Supply:", INITIAL_SUPPLY, "tokens");
  console.log("TimeLock Delay:", TIMELOCK_DELAY, "seconds (", TIMELOCK_DELAY / (24 * 60 * 60), "days )");
  console.log("MultiSig Owners:", MULTISIG_OWNERS.length);
  console.log("MultiSig Threshold:", MULTISIG_THRESHOLD);

  // 1. Deploy MultiSig Wallet
  console.log("\n1️⃣ Deploying MultiSig Wallet...");
  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const multiSig = await MultiSigWallet.deploy(MULTISIG_OWNERS, MULTISIG_THRESHOLD);
  await multiSig.waitForDeployment();
  const multiSigAddress = await multiSig.getAddress();
  console.log("✅ MultiSig deployed to:", multiSigAddress);

  // 2. Deploy TimeLock
  console.log("\n2️⃣ Deploying TimeLock...");
  const TimeLock = await ethers.getContractFactory("TimeLock");
  const proposers = [multiSigAddress]; // MultiSig can propose
  const executors = [multiSigAddress]; // MultiSig can execute
  const timeLock = await TimeLock.deploy(TIMELOCK_DELAY, proposers, executors, admin.address);
  await timeLock.waitForDeployment();
  const timeLockAddress = await timeLock.getAddress();
  console.log("✅ TimeLock deployed to:", timeLockAddress);

  // 3. Deploy Governed StableCoin
  console.log("\n3️⃣ Deploying Governed StableCoin...");
  const GovernedStableCoin = await ethers.getContractFactory("GovernedStableCoin");
  const governedCoin = await GovernedStableCoin.deploy(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    INITIAL_SUPPLY,
    admin.address,
    timeLockAddress
  );
  await governedCoin.waitForDeployment();
  const governedCoinAddress = await governedCoin.getAddress();
  console.log("✅ Governed StableCoin deployed to:", governedCoinAddress);

  // 4. Verification
  console.log("\n🔍 Verifying deployment...");

  // Verify MultiSig
  const owners = await multiSig.getOwners();
  const required = await multiSig.numConfirmationsRequired();
  console.log("MultiSig Owners:", owners);
  console.log("MultiSig Required Confirmations:", required.toString());

  // Verify TimeLock
  const delay = await timeLock.delay();
  const hasProposerRole = await timeLock.hasRole(await timeLock.PROPOSER_ROLE(), multiSigAddress);
  const hasExecutorRole = await timeLock.hasRole(await timeLock.EXECUTOR_ROLE(), multiSigAddress);
  console.log("TimeLock Delay:", delay.toString(), "seconds");
  console.log("MultiSig has Proposer Role:", hasProposerRole);
  console.log("MultiSig has Executor Role:", hasExecutorRole);

  // Verify Token
  const tokenName = await governedCoin.name();
  const tokenSymbol = await governedCoin.symbol();
  const totalSupply = await governedCoin.totalSupply();
  const adminBalance = await governedCoin.balanceOf(admin.address);
  const hasDefaultAdminRole = await governedCoin.hasRole(await governedCoin.DEFAULT_ADMIN_ROLE(), timeLockAddress);
  const hasMinterRole = await governedCoin.hasRole(await governedCoin.MINTER_ROLE(), admin.address);

  console.log("Token Name:", tokenName);
  console.log("Token Symbol:", tokenSymbol);
  console.log("Total Supply:", ethers.formatEther(totalSupply), tokenSymbol);
  console.log("Admin Balance:", ethers.formatEther(adminBalance), tokenSymbol);
  console.log("TimeLock has DEFAULT_ADMIN_ROLE:", hasDefaultAdminRole);
  console.log("Admin has MINTER_ROLE:", hasMinterRole);

  // 5. Setup governance transition (optional)
  console.log("\n⚙️ Setting up governance transition...");
  
  // Transfer some tokens to other accounts for testing
  console.log("Transferring tokens for testing...");
  await governedCoin.connect(admin).transfer(proposer1.address, ethers.parseEther("10000"));
  await governedCoin.connect(admin).transfer(proposer2.address, ethers.parseEther("10000"));
  await governedCoin.connect(admin).transfer(executor1.address, ethers.parseEther("10000"));
  console.log("✅ Test tokens distributed");

  // 6. Demonstrate governance workflow
  console.log("\n🧪 Demonstrating governance workflow...");
  
  try {
    // Example: Queue a transaction to mint new tokens
    console.log("1. Preparing mint transaction...");
    const mintAmount = ethers.parseEther("50000");
    const mintData = governedCoin.interface.encodeFunctionData("mint", [admin.address, mintAmount]);
    
    // Submit transaction to MultiSig
    console.log("2. Submitting transaction to MultiSig...");
    await multiSig.connect(proposer1).submitTransaction(governedCoinAddress, 0, mintData);
    
    // Confirm transaction
    console.log("3. Confirming transaction...");
    await multiSig.connect(proposer2).confirmTransaction(0);
    
    // Note: In real scenario, you would queue this in TimeLock and wait for delay
    console.log("✅ Governance workflow demonstration complete");
    console.log("ℹ️  In production, the transaction would be queued in TimeLock with delay");
    
  } catch (error) {
    console.log("⚠️  Governance workflow demonstration skipped:", error.message);
  }

  // 7. Display deployment summary
  console.log("\n📋 Deployment Summary:");
  console.log("=====================================");
  console.log("Network:", hre.network.name);
  console.log("MultiSig Wallet:", multiSigAddress);
  console.log("TimeLock Controller:", timeLockAddress);
  console.log("Governed StableCoin:", governedCoinAddress);
  console.log("=====================================");

  // 8. Next steps guidance
  console.log("\n📖 Next Steps:");
  console.log("1. Test governance functions on testnet");
  console.log("2. Consider transferring admin roles from EOA to governance contracts");
  console.log("3. Set up monitoring for governance proposals");
  console.log("4. Document governance procedures for stakeholders");

  if (hre.network.name === "sepolia" || hre.network.name === "mainnet") {
    console.log("\n🔗 Verification Commands:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${multiSigAddress} '[${MULTISIG_OWNERS.map(addr => `"${addr}"`).join(',')}]' ${MULTISIG_THRESHOLD}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${timeLockAddress} ${TIMELOCK_DELAY} '[${proposers.map(addr => `"${addr}"`).join(',')}]' '[${executors.map(addr => `"${addr}"`).join(',')}]' "${admin.address}"`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${governedCoinAddress} "${TOKEN_NAME}" "${TOKEN_SYMBOL}" ${INITIAL_SUPPLY} "${admin.address}" "${timeLockAddress}"`);
  }

  return {
    multiSig,
    multiSigAddress,
    timeLock,
    timeLockAddress,
    governedCoin,
    governedCoinAddress,
    addresses: {
      deployer: deployer.address,
      admin: admin.address,
      proposer1: proposer1.address,
      proposer2: proposer2.address,
      executor1: executor1.address,
      executor2: executor2.address
    }
  };
}

main()
  .then((result) => {
    console.log("\n🎉 Governance system deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Governance deployment failed:");
    console.error(error);
    process.exit(1);
  });