const { ethers } = require("ethers");
require("dotenv").config();

/**
 * Setup script for connecting to blockchain and contracts
 * Supports both local and testnet deployments
 */

class ContractSetup {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contracts = {};
        this.network = null;
    }

    // Initialize provider and signer
    async init(networkType = "local") {
        console.log(`🔗 Initializing connection to ${networkType} network...`);
        
        try {
            if (networkType === "local") {
                // Connect to local Hardhat node
                this.provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
                this.network = "localhost";
            } else if (networkType === "sepolia") {
                // Connect to Sepolia testnet
                const rpcUrl = process.env.SEPOLIA_RPC_URL;
                if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not found in .env file");
                
                this.provider = new ethers.JsonRpcProvider(rpcUrl);
                this.network = "sepolia";
            } else {
                throw new Error("Unsupported network type. Use 'local' or 'sepolia'");
            }

            // Setup signer
            if (process.env.PRIVATE_KEY && networkType !== "local") {
                this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
                console.log("📝 Using wallet from PRIVATE_KEY");
            } else {
                // Use first account from provider (for local development)
                this.signer = await this.provider.getSigner();
                console.log("📝 Using provider signer");
            }

            const signerAddress = await this.signer.getAddress();
            const balance = await this.provider.getBalance(signerAddress);
            
            console.log("✅ Connection established");
            console.log("📍 Network:", this.network);
            console.log("👤 Signer address:", signerAddress);
            console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
            
            return true;
        } catch (error) {
            console.error("❌ Failed to initialize:", error.message);
            return false;
        }
    }

    // Load contract instances
    async loadContracts(contractAddresses) {
        console.log("\n📄 Loading contract instances...");
        
        try {
            // Load StableCoin contract
            if (contractAddresses.stableCoin) {
                const StableCoin = await ethers.getContractFactory("StableCoin", this.signer);
                this.contracts.stableCoin = StableCoin.attach(contractAddresses.stableCoin);
                console.log("✅ StableCoin loaded at:", contractAddresses.stableCoin);
            }

            // Load OptimizedStableCoin contract
            if (contractAddresses.optimizedStableCoin) {
                const OptimizedStableCoin = await ethers.getContractFactory("OptimizedStableCoin", this.signer);
                this.contracts.optimizedStableCoin = OptimizedStableCoin.attach(contractAddresses.optimizedStableCoin);
                console.log("✅ OptimizedStableCoin loaded at:", contractAddresses.optimizedStableCoin);
            }

            // Load MultiSigWallet contract
            if (contractAddresses.multiSig) {
                const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet", this.signer);
                this.contracts.multiSig = MultiSigWallet.attach(contractAddresses.multiSig);
                console.log("✅ MultiSigWallet loaded at:", contractAddresses.multiSig);
            }

            // Load TimeLock contract
            if (contractAddresses.timeLock) {
                const TimeLock = await ethers.getContractFactory("TimeLock", this.signer);
                this.contracts.timeLock = TimeLock.attach(contractAddresses.timeLock);
                console.log("✅ TimeLock loaded at:", contractAddresses.timeLock);
            }

            // Load GovernedStableCoin contract
            if (contractAddresses.governedStableCoin) {
                const GovernedStableCoin = await ethers.getContractFactory("GovernedStableCoin", this.signer);
                this.contracts.governedStableCoin = GovernedStableCoin.attach(contractAddresses.governedStableCoin);
                console.log("✅ GovernedStableCoin loaded at:", contractAddresses.governedStableCoin);
            }

            return this.contracts;
        } catch (error) {
            console.error("❌ Failed to load contracts:", error.message);
            return null;
        }
    }

    // Verify contract connections
    async verifyContracts() {
        console.log("\n🔍 Verifying contract connections...");
        
        for (const [name, contract] of Object.entries(this.contracts)) {
            try {
                if (name.includes("StableCoin") || name.includes("Coin")) {
                    const tokenName = await contract.name();
                    const symbol = await contract.symbol();
                    const totalSupply = await contract.totalSupply();
                    
                    console.log(`✅ ${name}:`);
                    console.log(`   Name: ${tokenName}`);
                    console.log(`   Symbol: ${symbol}`);
                    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
                } else if (name === "multiSig") {
                    const owners = await contract.getOwners();
                    const required = await contract.numConfirmationsRequired();
                    
                    console.log(`✅ ${name}:`);
                    console.log(`   Owners: ${owners.length}`);
                    console.log(`   Required: ${required}`);
                } else if (name === "timeLock") {
                    const delay = await contract.delay();
                    
                    console.log(`✅ ${name}:`);
                    console.log(`   Delay: ${delay} seconds (${delay / (24 * 60 * 60)} days)`);
                }
            } catch (error) {
                console.log(`❌ ${name}: ${error.message}`);
            }
        }
    }

    // Get network info
    async getNetworkInfo() {
        const network = await this.provider.getNetwork();
        const blockNumber = await this.provider.getBlockNumber();
        const gasPrice = await this.provider.getFeeData();
        
        return {
            chainId: network.chainId,
            name: network.name,
            blockNumber,
            gasPrice: gasPrice.gasPrice
        };
    }

    // Utility function to wait for transaction confirmation
    async waitForTransaction(tx, confirmations = 1) {
        console.log("⏳ Waiting for transaction:", tx.hash);
        const receipt = await tx.wait(confirmations);
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("⛽ Gas used:", receipt.gasUsed.toString());
        return receipt;
    }

    // Format and display transaction receipt
    displayReceipt(receipt) {
        console.log("\n📋 Transaction Receipt:");
        console.log("Hash:", receipt.hash);
        console.log("Block:", receipt.blockNumber);
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log("Gas Price:", ethers.formatUnits(receipt.gasPrice || 0, "gwei"), "gwei");
        console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
        
        if (receipt.logs && receipt.logs.length > 0) {
            console.log("📝 Events emitted:", receipt.logs.length);
        }
    }
}

// Default contract addresses for local development
const DEFAULT_ADDRESSES = {
    local: {
        // These will be updated when contracts are deployed locally
        stableCoin: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        multiSig: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        timeLock: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
        governedStableCoin: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    },
    sepolia: {
        // Update these with actual Sepolia deployment addresses
        stableCoin: process.env.SEPOLIA_STABLECOIN_ADDRESS || "",
        multiSig: process.env.SEPOLIA_MULTISIG_ADDRESS || "",
        timeLock: process.env.SEPOLIA_TIMELOCK_ADDRESS || "",
        governedStableCoin: process.env.SEPOLIA_GOVERNED_COIN_ADDRESS || ""
    }
};

// Export for use in other scripts
module.exports = {
    ContractSetup,
    DEFAULT_ADDRESSES
};

// Main execution when run directly
async function main() {
    const networkType = process.argv[2] || "local";
    
    const setup = new ContractSetup();
    
    // Initialize connection
    const connected = await setup.init(networkType);
    if (!connected) {
        process.exit(1);
    }

    // Load contracts
    const addresses = DEFAULT_ADDRESSES[networkType] || DEFAULT_ADDRESSES.local;
    const contracts = await setup.loadContracts(addresses);
    
    if (!contracts) {
        console.log("❌ Failed to load contracts");
        process.exit(1);
    }

    // Verify contracts
    await setup.verifyContracts();

    // Display network info
    console.log("\n🌐 Network Information:");
    const networkInfo = await setup.getNetworkInfo();
    console.log("Chain ID:", networkInfo.chainId);
    console.log("Network:", networkInfo.name);
    console.log("Block Number:", networkInfo.blockNumber);
    console.log("Gas Price:", ethers.formatUnits(networkInfo.gasPrice || 0, "gwei"), "gwei");

    console.log("\n🎉 Setup complete! Contracts are ready for interaction.");
}

// Run main function if script is executed directly
if (require.main === module) {
    main().catch(console.error);
}