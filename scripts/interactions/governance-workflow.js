const { ethers } = require("ethers");
const { ContractSetup, DEFAULT_ADDRESSES } = require("./setup.js");
const MultiSigOperations = require("./multisig-operations.js");

/**
 * Governance workflow script
 * Demonstrates complete governance processes using MultiSig + TimeLock + GovernedStableCoin
 */

class GovernanceWorkflow {
    constructor(setup) {
        this.setup = setup;
        this.multiSig = null;
        this.timeLock = null;
        this.governedCoin = null;
        this.multiSigOps = null;
    }

    // Initialize with governance contracts
    async init() {
        if (!this.setup.contracts.multiSig) {
            throw new Error("MultiSig contract not found");
        }
        if (!this.setup.contracts.timeLock) {
            throw new Error("TimeLock contract not found");
        }
        if (!this.setup.contracts.governedStableCoin) {
            throw new Error("GovernedStableCoin contract not found");
        }

        this.multiSig = this.setup.contracts.multiSig;
        this.timeLock = this.setup.contracts.timeLock;
        this.governedCoin = this.setup.contracts.governedStableCoin;
        
        this.multiSigOps = new MultiSigOperations(this.setup);
        this.multiSigOps.setContract("multiSig");
        
        console.log("🏛️ Governance contracts initialized");
    }

    // Get governance system overview
    async getGovernanceOverview() {
        console.log("\n🏛️ Governance System Overview:");
        
        try {
            // MultiSig info
            const owners = await this.multiSig.getOwners();
            const required = await this.multiSig.numConfirmationsRequired ? 
                await this.multiSig.numConfirmationsRequired() : 
                await this.multiSig.required();
            
            // TimeLock info
            const delay = await this.timeLock.delay();
            const proposerRole = await this.timeLock.PROPOSER_ROLE();
            const executorRole = await this.timeLock.EXECUTOR_ROLE();
            const multiSigAddress = await this.multiSig.getAddress();
            
            const hasProposerRole = await this.timeLock.hasRole(proposerRole, multiSigAddress);
            const hasExecutorRole = await this.timeLock.hasRole(executorRole, multiSigAddress);
            
            // Token info
            const tokenName = await this.governedCoin.name();
            const tokenSymbol = await this.governedCoin.symbol();
            const totalSupply = await this.governedCoin.totalSupply();
            const defaultAdminRole = await this.governedCoin.DEFAULT_ADMIN_ROLE();
            const timeLockAddress = await this.timeLock.getAddress();
            const hasAdminRole = await this.governedCoin.hasRole(defaultAdminRole, timeLockAddress);

            console.log("📊 MultiSig Wallet:");
            console.log(`   Owners: ${owners.length} (${required} required)`);
            console.log(`   Has Proposer Role: ${hasProposerRole ? "✅" : "❌"}`);
            console.log(`   Has Executor Role: ${hasExecutorRole ? "✅" : "❌"}`);
            
            console.log("⏰ TimeLock Controller:");
            console.log(`   Delay: ${delay} seconds (${Number(delay) / (24 * 60 * 60)} days)`);
            console.log(`   Controls Token: ${hasAdminRole ? "✅" : "❌"}`);
            
            console.log("🪙 Governed Token:");
            console.log(`   Name: ${tokenName} (${tokenSymbol})`);
            console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${tokenSymbol}`);

            return {
                multiSig: { owners: owners.length, required },
                timeLock: { delay },
                token: { name: tokenName, symbol: tokenSymbol, totalSupply }
            };
        } catch (error) {
            console.error("❌ Error getting governance overview:", error.message);
            return null;
        }
    }

    // Propose and execute a governance action
    async proposeAndExecuteGovernanceAction(
        target, 
        value, 
        functionSignature, 
        functionArgs, 
        description = "Governance proposal"
    ) {
        console.log(`\n🗳️ Starting governance proposal: ${description}`);
        console.log(`Target: ${target}`);
        console.log(`Function: ${functionSignature}`);
        console.log(`Args: ${JSON.stringify(functionArgs)}`);
        
        try {
            // Step 1: Encode function data
            const data = this.encodeFunctionData(functionSignature, functionArgs);
            console.log(`📝 Encoded data: ${data}`);
            
            // Step 2: Calculate execution time (current time + delay + buffer)
            const currentTime = Math.floor(Date.now() / 1000);
            const delay = await this.timeLock.delay();
            const executeTime = currentTime + Number(delay) + 300; // 5 minute buffer
            
            console.log(`⏰ Execution time: ${new Date(executeTime * 1000).toLocaleString()}`);
            
            // Step 3: Queue transaction in TimeLock via MultiSig
            console.log("\n1️⃣ Queuing transaction in TimeLock...");
            const queueResult = await this.queueTimeLockTransaction(target, value, functionSignature, data, executeTime);
            
            if (!queueResult) {
                throw new Error("Failed to queue transaction");
            }
            
            console.log("✅ Transaction queued successfully");
            
            // Step 4: Wait for delay (in real scenario, you'd wait for the actual delay)
            console.log("\n⏳ In production, you would wait for the TimeLock delay period...");
            console.log(`   Delay: ${Number(delay)} seconds (${Number(delay) / (24 * 60 * 60)} days)`);
            console.log(`   Ready at: ${new Date(executeTime * 1000).toLocaleString()}`);
            
            // For demo purposes, we'll show how to execute (but it will fail due to time constraint)
            console.log("\n2️⃣ Preparing execution (will fail due to time lock)...");
            const executeResult = await this.executeTimeLockTransaction(target, value, functionSignature, data, executeTime);
            
            return {
                queueResult,
                executeResult,
                txHash: queueResult?.txHash,
                executeTime
            };
            
        } catch (error) {
            console.error("❌ Governance proposal failed:", error.message);
            return null;
        }
    }

    // Queue transaction in TimeLock via MultiSig
    async queueTimeLockTransaction(target, value, signature, data, executeTime) {
        try {
            // Encode the queueTransaction call
            const timeLockAddress = await this.timeLock.getAddress();
            const queueData = this.timeLock.interface.encodeFunctionData("queueTransaction", [
                target, value, signature, data, executeTime
            ]);
            
            // Submit to MultiSig
            const result = await this.multiSigOps.submitTransaction(timeLockAddress, 0, queueData);
            
            if (result) {
                // Auto-confirm if possible (in real scenario, other owners would confirm)
                console.log("📝 Auto-confirming transaction (demo purposes)...");
                await this.multiSigOps.confirmTransaction(result.txIndex);
                
                // Execute the MultiSig transaction
                console.log("🚀 Executing MultiSig transaction...");
                await this.multiSigOps.executeTransaction(result.txIndex);
                
                return { ...result, queueExecuteTime: executeTime };
            }
            
            return null;
        } catch (error) {
            console.error("❌ Queue TimeLock transaction failed:", error.message);
            return null;
        }
    }

    // Execute transaction from TimeLock via MultiSig
    async executeTimeLockTransaction(target, value, signature, data, executeTime) {
        try {
            // Encode the executeTransaction call
            const timeLockAddress = await this.timeLock.getAddress();
            const executeData = this.timeLock.interface.encodeFunctionData("executeTransaction", [
                target, value, signature, data, executeTime
            ]);
            
            // Submit to MultiSig
            const result = await this.multiSigOps.submitTransaction(timeLockAddress, 0, executeData);
            
            if (result) {
                // Auto-confirm and execute
                await this.multiSigOps.confirmTransaction(result.txIndex);
                await this.multiSigOps.executeTransaction(result.txIndex);
                return result;
            }
            
            return null;
        } catch (error) {
            console.error("❌ Execute TimeLock transaction failed:", error.message);
            return null;
        }
    }

    // Cancel a queued transaction
    async cancelQueuedTransaction(target, value, signature, data, executeTime) {
        console.log("\n❌ Cancelling queued transaction...");
        
        try {
            // Only admin can cancel directly, or via governance
            const tx = await this.timeLock.cancelTransaction(target, value, signature, data, executeTime);
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            console.log("✅ Transaction cancelled successfully");
            return receipt;
        } catch (error) {
            console.error("❌ Cancel transaction failed:", error.message);
            return null;
        }
    }

    // Helper: Encode function data
    encodeFunctionData(signature, args) {
        const fragment = ethers.FunctionFragment.from(signature);
        const iface = new ethers.Interface([fragment]);
        return iface.encodeFunctionData(fragment.name, args);
    }

    // Common governance proposals
    async proposeMintTokens(recipient, amount) {
        const governedCoinAddress = await this.governedCoin.getAddress();
        const amountWei = ethers.parseEther(amount.toString());
        
        return await this.proposeAndExecuteGovernanceAction(
            governedCoinAddress,
            0,
            "mint(address,uint256)",
            [recipient, amountWei],
            `Mint ${amount} tokens to ${recipient}`
        );
    }

    async proposePauseContract() {
        const governedCoinAddress = await this.governedCoin.getAddress();
        
        return await this.proposeAndExecuteGovernanceAction(
            governedCoinAddress,
            0,
            "pause()",
            [],
            "Pause the governed token contract"
        );
    }

    async proposeUnpauseContract() {
        const governedCoinAddress = await this.governedCoin.getAddress();
        
        return await this.proposeAndExecuteGovernanceAction(
            governedCoinAddress,
            0,
            "unpause()",
            [],
            "Unpause the governed token contract"
        );
    }

    async proposeBlacklistAddress(address) {
        const governedCoinAddress = await this.governedCoin.getAddress();
        
        return await this.proposeAndExecuteGovernanceAction(
            governedCoinAddress,
            0,
            "blacklist(address)",
            [address],
            `Blacklist address ${address}`
        );
    }

    async proposeGrantRole(role, account) {
        const governedCoinAddress = await this.governedCoin.getAddress();
        let functionName;
        
        switch (role) {
            case "MINTER_ROLE":
                functionName = "grantMinterRole(address)";
                break;
            case "PAUSER_ROLE":
                functionName = "grantPauserRole(address)";
                break;
            case "BLACKLIST_ROLE":
                functionName = "grantBlacklistRole(address)";
                break;
            default:
                throw new Error(`Unknown role: ${role}`);
        }
        
        return await this.proposeAndExecuteGovernanceAction(
            governedCoinAddress,
            0,
            functionName,
            [account],
            `Grant ${role} to ${account}`
        );
    }

    async proposeRevokeRole(role, account) {
        const governedCoinAddress = await this.governedCoin.getAddress();
        let functionName;
        
        switch (role) {
            case "MINTER_ROLE":
                functionName = "revokeMinterRole(address)";
                break;
            case "PAUSER_ROLE":
                functionName = "revokePauserRole(address)";
                break;
            case "BLACKLIST_ROLE":
                functionName = "revokeBlacklistRole(address)";
                break;
            default:
                throw new Error(`Unknown role: ${role}`);
        }
        
        return await this.proposeAndExecuteGovernanceAction(
            governedCoinAddress,
            0,
            functionName,
            [account],
            `Revoke ${role} from ${account}`
        );
    }

    async proposeUpdateTimeLockDelay(newDelay) {
        const timeLockAddress = await this.timeLock.getAddress();
        
        return await this.proposeAndExecuteGovernanceAction(
            timeLockAddress,
            0,
            "updateDelay(uint256)",
            [newDelay],
            `Update TimeLock delay to ${newDelay} seconds (${newDelay / (24 * 60 * 60)} days)`
        );
    }

    // Get queued transactions (if any)
    async getQueuedTransactions() {
        console.log("\n📋 Queued TimeLock Transactions:");
        // Note: This would require events or additional storage to track queued transactions
        console.log("ℹ️ To get queued transactions, you'd need to query TimeLock events");
        console.log("   Filter for 'QueueTransaction' events from the TimeLock contract");
        
        try {
            const filter = this.timeLock.filters.QueueTransaction();
            const events = await this.timeLock.queryFilter(filter, -10000); // Last 10k blocks
            
            console.log(`Found ${events.length} queued transaction events:`);
            
            events.slice(-5).forEach((event, index) => {
                const { txHash, target, value, signature, data, executeTime } = event.args;
                console.log(`\n${index + 1}. Transaction Hash: ${txHash}`);
                console.log(`   Target: ${target}`);
                console.log(`   Value: ${ethers.formatEther(value)} ETH`);
                console.log(`   Function: ${signature}`);
                console.log(`   Execute Time: ${new Date(Number(executeTime) * 1000).toLocaleString()}`);
            });
            
            return events;
        } catch (error) {
            console.error("❌ Error getting queued transactions:", error.message);
            return [];
        }
    }

    // Check if current signer can perform governance actions
    async checkGovernancePermissions() {
        console.log("\n🔐 Checking governance permissions:");
        
        try {
            const signerAddress = await this.setup.signer.getAddress();
            
            // Check MultiSig ownership
            const isMultiSigOwner = await this.multiSig.isOwner(signerAddress);
            console.log(`MultiSig Owner: ${isMultiSigOwner ? "✅" : "❌"}`);
            
            // Check TimeLock roles
            const proposerRole = await this.timeLock.PROPOSER_ROLE();
            const executorRole = await this.timeLock.EXECUTOR_ROLE();
            const cancellerRole = await this.timeLock.CANCELLER_ROLE();
            
            const hasProposer = await this.timeLock.hasRole(proposerRole, signerAddress);
            const hasExecutor = await this.timeLock.hasRole(executorRole, signerAddress);
            const hasCanceller = await this.timeLock.hasRole(cancellerRole, signerAddress);
            
            console.log(`TimeLock Proposer: ${hasProposer ? "✅" : "❌"}`);
            console.log(`TimeLock Executor: ${hasExecutor ? "✅" : "❌"}`);
            console.log(`TimeLock Canceller: ${hasCanceller ? "✅" : "❌"}`);
            
            // Check token roles
            const minterRole = await this.governedCoin.MINTER_ROLE();
            const pauserRole = await this.governedCoin.PAUSER_ROLE();
            const blacklistRole = await this.governedCoin.BLACKLIST_ROLE();
            const adminRole = await this.governedCoin.DEFAULT_ADMIN_ROLE();
            
            const hasMinter = await this.governedCoin.hasRole(minterRole, signerAddress);
            const hasPauser = await this.governedCoin.hasRole(pauserRole, signerAddress);
            const hasBlacklist = await this.governedCoin.hasRole(blacklistRole, signerAddress);
            const hasAdmin = await this.governedCoin.hasRole(adminRole, signerAddress);
            
            console.log(`Token Minter: ${hasMinter ? "✅" : "❌"}`);
            console.log(`Token Pauser: ${hasPauser ? "✅" : "❌"}`);
            console.log(`Token Blacklister: ${hasBlacklist ? "✅" : "❌"}`);
            console.log(`Token Admin: ${hasAdmin ? "✅" : "❌"}`);
            
            return {
                multiSig: isMultiSigOwner,
                timeLock: { proposer: hasProposer, executor: hasExecutor, canceller: hasCanceller },
                token: { minter: hasMinter, pauser: hasPauser, blacklister: hasBlacklist, admin: hasAdmin }
            };
        } catch (error) {
            console.error("❌ Error checking permissions:", error.message);
            return null;
        }
    }
}

// Demo script
async function runDemo() {
    const networkType = process.argv[2] || "local";
    
    console.log("🎬 Starting Governance Workflow Demo");
    
    // Setup connection
    const setup = new ContractSetup();
    const connected = await setup.init(networkType);
    if (!connected) return;
    
    // Load contracts
    const addresses = DEFAULT_ADDRESSES[networkType] || DEFAULT_ADDRESSES.local;
    await setup.loadContracts(addresses);
    
    // Create governance workflow instance
    const governance = new GovernanceWorkflow(setup);
    await governance.init();
    
    // Demo operations
    try {
        // Get governance overview
        await governance.getGovernanceOverview();
        
        // Check permissions
        await governance.checkGovernancePermissions();
        
        // Get any queued transactions
        await governance.getQueuedTransactions();
        
        // Demo: Propose minting tokens
        const testAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        console.log(`\n🎯 Demo: Proposing to mint 1000 tokens to ${testAddress}`);
        
        const result = await governance.proposeMintTokens(testAddress, 1000);
        
        if (result) {
            console.log("✅ Governance proposal submitted successfully");
            console.log(`   Transaction will be executable at: ${new Date(result.executeTime * 1000).toLocaleString()}`);
        }
        
        console.log("\n✅ Demo completed successfully!");
        
    } catch (error) {
        console.error("❌ Demo failed:", error.message);
    }
}

// Export for use in other scripts
module.exports = GovernanceWorkflow;

// Run demo if script is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}