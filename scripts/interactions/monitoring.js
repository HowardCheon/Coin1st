const { ethers } = require("ethers");
const { ContractSetup, DEFAULT_ADDRESSES } = require("./setup.js");

/**
 * Contract monitoring and analytics script
 * Provides real-time monitoring and historical analysis of contracts
 */

class ContractMonitor {
    constructor(setup) {
        this.setup = setup;
        this.contracts = {};
        this.eventListeners = new Map();
    }

    // Initialize monitoring for specific contracts
    async init(contractNames = ["stableCoin", "multiSig", "timeLock", "governedStableCoin"]) {
        console.log("📊 Initializing contract monitoring...");
        
        for (const name of contractNames) {
            if (this.setup.contracts[name]) {
                this.contracts[name] = this.setup.contracts[name];
                console.log(`✅ Monitoring ${name}`);
            }
        }
    }

    // Real-time event monitoring
    async startEventMonitoring(contractName, eventName = null) {
        const contract = this.contracts[contractName];
        if (!contract) {
            console.error(`❌ Contract ${contractName} not found`);
            return;
        }

        console.log(`👂 Starting event monitoring for ${contractName}...`);
        
        try {
            if (eventName) {
                // Monitor specific event
                const filter = contract.filters[eventName]();
                const listener = (...args) => {
                    const event = args[args.length - 1];
                    this.handleEvent(contractName, eventName, event);
                };
                
                contract.on(filter, listener);
                this.eventListeners.set(`${contractName}-${eventName}`, { contract, filter, listener });
                console.log(`✅ Monitoring ${eventName} events on ${contractName}`);
            } else {
                // Monitor all events
                const listener = (event) => {
                    this.handleEvent(contractName, event.event, event);
                };
                
                contract.on("*", listener);
                this.eventListeners.set(`${contractName}-all`, { contract, listener });
                console.log(`✅ Monitoring all events on ${contractName}`);
            }
        } catch (error) {
            console.error(`❌ Failed to start monitoring ${contractName}:`, error.message);
        }
    }

    // Handle incoming events
    handleEvent(contractName, eventName, event) {
        const timestamp = new Date().toLocaleString();
        console.log(`\n🔔 [${timestamp}] ${contractName} - ${eventName}`);
        console.log(`   Block: ${event.blockNumber}`);
        console.log(`   Tx: ${event.transactionHash}`);
        
        if (event.args) {
            console.log(`   Args:`, event.args);
        }

        // Contract-specific event handling
        this.processSpecificEvent(contractName, eventName, event);
    }

    // Process specific events with business logic
    processSpecificEvent(contractName, eventName, event) {
        try {
            if (contractName.includes("StableCoin") || contractName.includes("Coin")) {
                this.processTokenEvent(eventName, event);
            } else if (contractName === "multiSig") {
                this.processMultiSigEvent(eventName, event);
            } else if (contractName === "timeLock") {
                this.processTimeLockEvent(eventName, event);
            }
        } catch (error) {
            console.error(`❌ Error processing ${eventName} event:`, error.message);
        }
    }

    // Process token-related events
    processTokenEvent(eventName, event) {
        switch (eventName) {
            case "Transfer":
                const [from, to, amount] = event.args;
                if (from === ethers.ZeroAddress) {
                    console.log(`   💰 MINT: ${ethers.formatEther(amount)} tokens to ${to}`);
                } else if (to === ethers.ZeroAddress) {
                    console.log(`   🔥 BURN: ${ethers.formatEther(amount)} tokens from ${from}`);
                } else {
                    console.log(`   💸 TRANSFER: ${ethers.formatEther(amount)} tokens from ${from} to ${to}`);
                }
                break;
                
            case "Approval":
                const [owner, spender, approvalAmount] = event.args;
                console.log(`   ✅ APPROVAL: ${owner} approved ${ethers.formatEther(approvalAmount)} tokens to ${spender}`);
                break;
                
            case "Blacklisted":
                console.log(`   🚫 BLACKLISTED: ${event.args[0]}`);
                break;
                
            case "UnBlacklisted":
                console.log(`   ✅ UN-BLACKLISTED: ${event.args[0]}`);
                break;
                
            case "Paused":
                console.log(`   ⏸️ CONTRACT PAUSED`);
                break;
                
            case "Unpaused":
                console.log(`   ▶️ CONTRACT UNPAUSED`);
                break;
        }
    }

    // Process MultiSig events
    processMultiSigEvent(eventName, event) {
        switch (eventName) {
            case "SubmitTransaction":
            case "TransactionSubmitted":
                const [owner, txIndex] = event.args;
                console.log(`   📝 NEW PROPOSAL: Transaction ${txIndex} submitted by ${owner}`);
                break;
                
            case "ConfirmTransaction":
            case "TransactionConfirmed":
                console.log(`   ✅ CONFIRMATION: Transaction ${event.args[1]} confirmed by ${event.args[0]}`);
                break;
                
            case "ExecuteTransaction":
            case "TransactionExecuted":
                console.log(`   🚀 EXECUTED: Transaction ${event.args[1]} executed by ${event.args[0]}`);
                break;
                
            case "RevokeConfirmation":
            case "TransactionRevoked":
                console.log(`   ❌ REVOKED: Confirmation revoked for transaction ${event.args[1]} by ${event.args[0]}`);
                break;
                
            case "Deposit":
                console.log(`   💰 DEPOSIT: ${ethers.formatEther(event.args[1])} ETH from ${event.args[0]}`);
                break;
        }
    }

    // Process TimeLock events
    processTimeLockEvent(eventName, event) {
        switch (eventName) {
            case "QueueTransaction":
                const [txHash, target, value, signature, data, executeTime] = event.args;
                console.log(`   ⏳ QUEUED: Transaction ${txHash}`);
                console.log(`      Target: ${target}`);
                console.log(`      Function: ${signature}`);
                console.log(`      Execute at: ${new Date(Number(executeTime) * 1000).toLocaleString()}`);
                break;
                
            case "ExecuteTransaction":
                console.log(`   ⚡ EXECUTED: TimeLock transaction ${event.args[0]}`);
                break;
                
            case "CancelTransaction":
                console.log(`   ❌ CANCELLED: TimeLock transaction ${event.args[0]}`);
                break;
        }
    }

    // Stop event monitoring
    stopEventMonitoring(contractName, eventName = null) {
        const key = eventName ? `${contractName}-${eventName}` : `${contractName}-all`;
        const listener = this.eventListeners.get(key);
        
        if (listener) {
            if (eventName) {
                listener.contract.off(listener.filter, listener.listener);
            } else {
                listener.contract.off("*", listener.listener);
            }
            this.eventListeners.delete(key);
            console.log(`🔇 Stopped monitoring ${key}`);
        }
    }

    // Stop all monitoring
    stopAllMonitoring() {
        console.log("🔇 Stopping all event monitoring...");
        for (const [key, listener] of this.eventListeners) {
            if (listener.filter) {
                listener.contract.off(listener.filter, listener.listener);
            } else {
                listener.contract.off("*", listener.listener);
            }
        }
        this.eventListeners.clear();
    }

    // Get historical events
    async getHistoricalEvents(contractName, eventName, fromBlock = 0, toBlock = "latest") {
        const contract = this.contracts[contractName];
        if (!contract) {
            console.error(`❌ Contract ${contractName} not found`);
            return [];
        }

        console.log(`📜 Getting historical ${eventName} events for ${contractName}...`);
        
        try {
            const filter = eventName === "*" ? {} : contract.filters[eventName]();
            const events = await contract.queryFilter(filter, fromBlock, toBlock);
            
            console.log(`Found ${events.length} ${eventName} events from block ${fromBlock} to ${toBlock}`);
            
            return events;
        } catch (error) {
            console.error(`❌ Error getting historical events:`, error.message);
            return [];
        }
    }

    // Analyze token transfer patterns
    async analyzeTokenTransfers(contractName, hours = 24) {
        console.log(`\n📊 Analyzing token transfers for last ${hours} hours...`);
        
        try {
            const currentBlock = await this.setup.provider.getBlockNumber();
            const blocksPerHour = 300; // Approximate for Ethereum (12s blocks)
            const fromBlock = Math.max(0, currentBlock - (hours * blocksPerHour));
            
            const events = await this.getHistoricalEvents(contractName, "Transfer", fromBlock);
            
            const stats = {
                totalTransfers: events.length,
                totalVolume: 0n,
                uniqueAddresses: new Set(),
                mints: 0,
                burns: 0,
                transfers: 0,
                topRecipients: new Map(),
                topSenders: new Map()
            };
            
            for (const event of events) {
                const [from, to, amount] = event.args;
                stats.totalVolume += amount;
                stats.uniqueAddresses.add(from);
                stats.uniqueAddresses.add(to);
                
                if (from === ethers.ZeroAddress) {
                    stats.mints++;
                } else if (to === ethers.ZeroAddress) {
                    stats.burns++;
                } else {
                    stats.transfers++;
                    
                    // Track top recipients and senders
                    stats.topRecipients.set(to, (stats.topRecipients.get(to) || 0n) + amount);
                    stats.topSenders.set(from, (stats.topSenders.get(from) || 0n) + amount);
                }
            }
            
            console.log(`📈 Transfer Analysis Results:`);
            console.log(`   Total Transfers: ${stats.totalTransfers}`);
            console.log(`   Total Volume: ${ethers.formatEther(stats.totalVolume)} tokens`);
            console.log(`   Unique Addresses: ${stats.uniqueAddresses.size}`);
            console.log(`   Mints: ${stats.mints}`);
            console.log(`   Burns: ${stats.burns}`);
            console.log(`   Regular Transfers: ${stats.transfers}`);
            
            // Top recipients
            const topRecipients = Array.from(stats.topRecipients.entries())
                .sort(([,a], [,b]) => Number(b - a))
                .slice(0, 5);
            
            console.log(`\n🏆 Top Recipients:`);
            topRecipients.forEach(([address, amount], index) => {
                console.log(`   ${index + 1}. ${address}: ${ethers.formatEther(amount)} tokens`);
            });
            
            return stats;
        } catch (error) {
            console.error("❌ Error analyzing transfers:", error.message);
            return null;
        }
    }

    // Monitor MultiSig activity
    async analyzeMultiSigActivity(hours = 24) {
        console.log(`\n🔐 Analyzing MultiSig activity for last ${hours} hours...`);
        
        try {
            const currentBlock = await this.setup.provider.getBlockNumber();
            const blocksPerHour = 300;
            const fromBlock = Math.max(0, currentBlock - (hours * blocksPerHour));
            
            const submitEvents = await this.getHistoricalEvents("multiSig", "SubmitTransaction", fromBlock);
            const confirmEvents = await this.getHistoricalEvents("multiSig", "ConfirmTransaction", fromBlock);
            const executeEvents = await this.getHistoricalEvents("multiSig", "ExecuteTransaction", fromBlock);
            
            console.log(`📊 MultiSig Activity:`);
            console.log(`   Proposals Submitted: ${submitEvents.length}`);
            console.log(`   Confirmations: ${confirmEvents.length}`);
            console.log(`   Executions: ${executeEvents.length}`);
            
            // Analyze owner participation
            const ownerActivity = new Map();
            
            [...submitEvents, ...confirmEvents, ...executeEvents].forEach(event => {
                const owner = event.args[0];
                ownerActivity.set(owner, (ownerActivity.get(owner) || 0) + 1);
            });
            
            console.log(`\n👥 Owner Participation:`);
            for (const [owner, count] of ownerActivity) {
                console.log(`   ${owner}: ${count} actions`);
            }
            
            return {
                submitted: submitEvents.length,
                confirmed: confirmEvents.length,
                executed: executeEvents.length,
                ownerActivity: Object.fromEntries(ownerActivity)
            };
        } catch (error) {
            console.error("❌ Error analyzing MultiSig activity:", error.message);
            return null;
        }
    }

    // Get contract balances and stats
    async getContractStats() {
        console.log("\n📊 Current Contract Statistics:");
        
        try {
            for (const [name, contract] of Object.entries(this.contracts)) {
                console.log(`\n📄 ${name.toUpperCase()}:`);
                
                if (name.includes("StableCoin") || name.includes("Coin")) {
                    const totalSupply = await contract.totalSupply();
                    const symbol = await contract.symbol();
                    const paused = await contract.paused();
                    
                    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
                    console.log(`   Paused: ${paused ? "Yes" : "No"}`);
                    
                } else if (name === "multiSig") {
                    const owners = await contract.getOwners();
                    const required = await contract.numConfirmationsRequired ? 
                        await contract.numConfirmationsRequired() : 
                        await contract.required();
                    const balance = await this.setup.provider.getBalance(await contract.getAddress());
                    const txCount = await contract.getTransactionCount();
                    
                    console.log(`   Owners: ${owners.length}`);
                    console.log(`   Required: ${required}`);
                    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
                    console.log(`   Total Transactions: ${txCount}`);
                    
                } else if (name === "timeLock") {
                    const delay = await contract.delay();
                    
                    console.log(`   Delay: ${delay} seconds (${Number(delay) / (24 * 60 * 60)} days)`);
                }
                
                // Get contract balance
                const contractBalance = await this.setup.provider.getBalance(await contract.getAddress());
                if (contractBalance > 0) {
                    console.log(`   ETH Balance: ${ethers.formatEther(contractBalance)} ETH`);
                }
            }
        } catch (error) {
            console.error("❌ Error getting contract stats:", error.message);
        }
    }

    // Monitor gas usage
    async monitorGasUsage(txHash) {
        try {
            const receipt = await this.setup.provider.getTransactionReceipt(txHash);
            const tx = await this.setup.provider.getTransaction(txHash);
            
            const gasUsed = receipt.gasUsed;
            const gasPrice = tx.gasPrice || receipt.gasPrice;
            const gasCost = gasUsed * gasPrice;
            
            console.log(`⛽ Gas Analysis for ${txHash}:`);
            console.log(`   Gas Used: ${gasUsed.toString()}`);
            console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
            console.log(`   Total Cost: ${ethers.formatEther(gasCost)} ETH`);
            console.log(`   Status: ${receipt.status === 1 ? "Success" : "Failed"}`);
            
            return { gasUsed, gasPrice, gasCost, status: receipt.status };
        } catch (error) {
            console.error("❌ Error monitoring gas usage:", error.message);
            return null;
        }
    }

    // Real-time dashboard
    async startDashboard(updateInterval = 30000) {
        console.log("🖥️ Starting real-time dashboard...");
        console.log(`📊 Updates every ${updateInterval / 1000} seconds`);
        
        const updateDashboard = async () => {
            console.clear();
            console.log("=".repeat(60));
            console.log("📊 STABLECOIN MONITORING DASHBOARD");
            console.log("=".repeat(60));
            console.log(`🕒 Last Update: ${new Date().toLocaleString()}`);
            
            await this.getContractStats();
            
            // Recent activity
            await this.analyzeTokenTransfers("stableCoin", 1); // Last hour
            await this.analyzeMultiSigActivity(1); // Last hour
        };
        
        // Initial update
        await updateDashboard();
        
        // Set interval for updates
        const intervalId = setInterval(updateDashboard, updateInterval);
        
        // Return function to stop dashboard
        return () => {
            clearInterval(intervalId);
            console.log("🔇 Dashboard stopped");
        };
    }
}

// Demo script
async function runDemo() {
    const networkType = process.argv[2] || "local";
    
    console.log("🎬 Starting Contract Monitoring Demo");
    
    // Setup connection
    const setup = new ContractSetup();
    const connected = await setup.init(networkType);
    if (!connected) return;
    
    // Load contracts
    const addresses = DEFAULT_ADDRESSES[networkType] || DEFAULT_ADDRESSES.local;
    await setup.loadContracts(addresses);
    
    // Create monitor instance
    const monitor = new ContractMonitor(setup);
    await monitor.init();
    
    try {
        // Get current stats
        await monitor.getContractStats();
        
        // Analyze historical data
        await monitor.analyzeTokenTransfers("stableCoin", 24);
        await monitor.analyzeMultiSigActivity(24);
        
        // Start event monitoring (for demo, we'll stop it quickly)
        await monitor.startEventMonitoring("stableCoin", "Transfer");
        
        console.log("\n👂 Event monitoring started (will stop in 10 seconds)...");
        
        // Stop monitoring after 10 seconds
        setTimeout(() => {
            monitor.stopAllMonitoring();
            console.log("\n✅ Demo completed!");
            process.exit(0);
        }, 10000);
        
    } catch (error) {
        console.error("❌ Demo failed:", error.message);
        process.exit(1);
    }
}

// Export for use in other scripts
module.exports = ContractMonitor;

// Run demo if script is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}