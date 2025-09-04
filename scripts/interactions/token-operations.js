const { ethers } = require("ethers");
const { ContractSetup, DEFAULT_ADDRESSES } = require("./setup.js");

/**
 * StableCoin token operations script
 * Demonstrates various token interactions like transfer, mint, burn, etc.
 */

class TokenOperations {
    constructor(setup) {
        this.setup = setup;
        this.contract = null;
    }

    // Initialize with a specific token contract
    setContract(contractName = "stableCoin") {
        if (!this.setup.contracts[contractName]) {
            throw new Error(`Contract ${contractName} not found`);
        }
        this.contract = this.setup.contracts[contractName];
        console.log(`🪙 Using ${contractName} contract`);
    }

    // Get token info
    async getTokenInfo() {
        console.log("\n📊 Token Information:");
        
        try {
            const name = await this.contract.name();
            const symbol = await this.contract.symbol();
            const decimals = await this.contract.decimals();
            const totalSupply = await this.contract.totalSupply();
            const owner = await this.contract.owner();
            const paused = await this.contract.paused();

            console.log("Name:", name);
            console.log("Symbol:", symbol);
            console.log("Decimals:", decimals);
            console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
            console.log("Owner:", owner);
            console.log("Paused:", paused ? "Yes" : "No");

            return {
                name, symbol, decimals, totalSupply, owner, paused
            };
        } catch (error) {
            console.error("❌ Error getting token info:", error.message);
            return null;
        }
    }

    // Check balance
    async checkBalance(address = null) {
        try {
            const targetAddress = address || await this.setup.signer.getAddress();
            const balance = await this.contract.balanceOf(targetAddress);
            const symbol = await this.contract.symbol();
            
            console.log(`💰 Balance of ${targetAddress}:`, ethers.formatEther(balance), symbol);
            return balance;
        } catch (error) {
            console.error("❌ Error checking balance:", error.message);
            return null;
        }
    }

    // Check multiple balances
    async checkMultipleBalances(addresses) {
        console.log("\n💰 Checking multiple balances:");
        
        const results = {};
        const symbol = await this.contract.symbol();
        
        for (const addr of addresses) {
            try {
                const balance = await this.contract.balanceOf(addr);
                const formattedBalance = ethers.formatEther(balance);
                console.log(`${addr}: ${formattedBalance} ${symbol}`);
                results[addr] = { balance, formatted: formattedBalance };
            } catch (error) {
                console.log(`${addr}: Error - ${error.message}`);
                results[addr] = { error: error.message };
            }
        }
        
        return results;
    }

    // Transfer tokens
    async transfer(to, amount, options = {}) {
        console.log(`\n💸 Transferring ${amount} tokens to ${to}...`);
        
        try {
            const amountWei = ethers.parseEther(amount.toString());
            
            // Check balance first
            const senderAddress = await this.setup.signer.getAddress();
            const balance = await this.contract.balanceOf(senderAddress);
            
            if (balance < amountWei) {
                throw new Error(`Insufficient balance. Have: ${ethers.formatEther(balance)}, Need: ${amount}`);
            }

            const tx = await this.contract.transfer(to, amountWei, {
                gasLimit: options.gasLimit || 100000,
                gasPrice: options.gasPrice
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new balances
            await this.checkBalance(senderAddress);
            await this.checkBalance(to);
            
            return receipt;
        } catch (error) {
            console.error("❌ Transfer failed:", error.message);
            return null;
        }
    }

    // Batch transfer (if contract supports it)
    async batchTransfer(recipients, amounts, options = {}) {
        console.log(`\n💸 Batch transferring to ${recipients.length} recipients...`);
        
        try {
            // Check if contract has batchTransfer function
            if (!this.contract.batchTransfer) {
                throw new Error("Contract doesn't support batch transfer");
            }

            const amountsWei = amounts.map(amount => ethers.parseEther(amount.toString()));
            
            console.log("Recipients:", recipients);
            console.log("Amounts:", amounts);
            
            const tx = await this.contract.batchTransfer(recipients, amountsWei, {
                gasLimit: options.gasLimit || 300000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new balances
            await this.checkMultipleBalances(recipients);
            
            return receipt;
        } catch (error) {
            console.error("❌ Batch transfer failed:", error.message);
            return null;
        }
    }

    // Approve spending
    async approve(spender, amount, options = {}) {
        console.log(`\n✅ Approving ${spender} to spend ${amount} tokens...`);
        
        try {
            const amountWei = ethers.parseEther(amount.toString());
            
            const tx = await this.contract.approve(spender, amountWei, {
                gasLimit: options.gasLimit || 80000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check allowance
            const allowance = await this.contract.allowance(
                await this.setup.signer.getAddress(), 
                spender
            );
            console.log("New allowance:", ethers.formatEther(allowance));
            
            return receipt;
        } catch (error) {
            console.error("❌ Approval failed:", error.message);
            return null;
        }
    }

    // Transfer from (using allowance)
    async transferFrom(from, to, amount, options = {}) {
        console.log(`\n💸 Transferring ${amount} tokens from ${from} to ${to}...`);
        
        try {
            const amountWei = ethers.parseEther(amount.toString());
            
            // Check allowance
            const allowance = await this.contract.allowance(from, await this.setup.signer.getAddress());
            if (allowance < amountWei) {
                throw new Error(`Insufficient allowance. Have: ${ethers.formatEther(allowance)}, Need: ${amount}`);
            }
            
            const tx = await this.contract.transferFrom(from, to, amountWei, {
                gasLimit: options.gasLimit || 120000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new balances and allowance
            await this.checkBalance(from);
            await this.checkBalance(to);
            
            const newAllowance = await this.contract.allowance(from, await this.setup.signer.getAddress());
            console.log("Remaining allowance:", ethers.formatEther(newAllowance));
            
            return receipt;
        } catch (error) {
            console.error("❌ TransferFrom failed:", error.message);
            return null;
        }
    }

    // Mint tokens (owner only)
    async mint(to, amount, options = {}) {
        console.log(`\n🏭 Minting ${amount} tokens to ${to}...`);
        
        try {
            const amountWei = ethers.parseEther(amount.toString());
            
            const tx = await this.contract.mint(to, amountWei, {
                gasLimit: options.gasLimit || 100000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new balance and total supply
            await this.checkBalance(to);
            const totalSupply = await this.contract.totalSupply();
            console.log("New total supply:", ethers.formatEther(totalSupply));
            
            return receipt;
        } catch (error) {
            console.error("❌ Minting failed:", error.message);
            return null;
        }
    }

    // Burn tokens
    async burn(amount, options = {}) {
        console.log(`\n🔥 Burning ${amount} tokens...`);
        
        try {
            const amountWei = ethers.parseEther(amount.toString());
            
            // Check balance first
            const balance = await this.contract.balanceOf(await this.setup.signer.getAddress());
            if (balance < amountWei) {
                throw new Error(`Insufficient balance to burn. Have: ${ethers.formatEther(balance)}, Need: ${amount}`);
            }
            
            const tx = await this.contract.burn(amountWei, {
                gasLimit: options.gasLimit || 80000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new balance and total supply
            await this.checkBalance();
            const totalSupply = await this.contract.totalSupply();
            console.log("New total supply:", ethers.formatEther(totalSupply));
            
            return receipt;
        } catch (error) {
            console.error("❌ Burning failed:", error.message);
            return null;
        }
    }

    // Pause contract (owner only)
    async pause(options = {}) {
        console.log("\n⏸️ Pausing contract...");
        
        try {
            const tx = await this.contract.pause({
                gasLimit: options.gasLimit || 50000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            const paused = await this.contract.paused();
            console.log("Contract paused:", paused);
            
            return receipt;
        } catch (error) {
            console.error("❌ Pause failed:", error.message);
            return null;
        }
    }

    // Unpause contract (owner only)
    async unpause(options = {}) {
        console.log("\n▶️ Unpausing contract...");
        
        try {
            const tx = await this.contract.unpause({
                gasLimit: options.gasLimit || 50000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            const paused = await this.contract.paused();
            console.log("Contract paused:", paused);
            
            return receipt;
        } catch (error) {
            console.error("❌ Unpause failed:", error.message);
            return null;
        }
    }

    // Blacklist address (owner only)
    async blacklist(address, options = {}) {
        console.log(`\n🚫 Blacklisting address ${address}...`);
        
        try {
            const tx = await this.contract.blacklist(address, {
                gasLimit: options.gasLimit || 80000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            const isBlacklisted = await this.contract.isBlacklisted(address);
            console.log("Address blacklisted:", isBlacklisted);
            
            return receipt;
        } catch (error) {
            console.error("❌ Blacklisting failed:", error.message);
            return null;
        }
    }

    // Remove from blacklist (owner only)
    async unBlacklist(address, options = {}) {
        console.log(`\n✅ Removing ${address} from blacklist...`);
        
        try {
            const tx = await this.contract.unBlacklist(address, {
                gasLimit: options.gasLimit || 50000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            const isBlacklisted = await this.contract.isBlacklisted(address);
            console.log("Address blacklisted:", isBlacklisted);
            
            return receipt;
        } catch (error) {
            console.error("❌ Un-blacklisting failed:", error.message);
            return null;
        }
    }

    // Batch blacklist (if supported)
    async batchBlacklist(addresses, options = {}) {
        console.log(`\n🚫 Batch blacklisting ${addresses.length} addresses...`);
        
        try {
            if (!this.contract.batchBlacklist) {
                throw new Error("Contract doesn't support batch blacklist");
            }

            const tx = await this.contract.batchBlacklist(addresses, {
                gasLimit: options.gasLimit || (80000 * addresses.length)
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check blacklist status for all addresses
            console.log("Blacklist status:");
            for (const addr of addresses) {
                const isBlacklisted = await this.contract.isBlacklisted(addr);
                console.log(`${addr}: ${isBlacklisted ? "✅ Blacklisted" : "❌ Not blacklisted"}`);
            }
            
            return receipt;
        } catch (error) {
            console.error("❌ Batch blacklisting failed:", error.message);
            return null;
        }
    }

    // Check allowance
    async checkAllowance(owner, spender) {
        try {
            const allowance = await this.contract.allowance(owner, spender);
            const symbol = await this.contract.symbol();
            console.log(`📋 Allowance from ${owner} to ${spender}:`, ethers.formatEther(allowance), symbol);
            return allowance;
        } catch (error) {
            console.error("❌ Error checking allowance:", error.message);
            return null;
        }
    }

    // Get transaction history (events)
    async getTransferHistory(address, fromBlock = 0) {
        console.log(`\n📜 Getting transfer history for ${address}...`);
        
        try {
            // Get Transfer events
            const filter = this.contract.filters.Transfer();
            const events = await this.contract.queryFilter(filter, fromBlock);
            
            const relevantEvents = events.filter(event => 
                event.args[0] === address || event.args[1] === address
            );
            
            console.log(`Found ${relevantEvents.length} relevant transfer events:`);
            
            for (const event of relevantEvents.slice(-10)) { // Show last 10
                const [from, to, amount] = event.args;
                const formattedAmount = ethers.formatEther(amount);
                const direction = from === address ? "Sent" : "Received";
                
                console.log(`Block ${event.blockNumber}: ${direction} ${formattedAmount} tokens ${direction === "Sent" ? "to" : "from"} ${direction === "Sent" ? to : from}`);
            }
            
            return relevantEvents;
        } catch (error) {
            console.error("❌ Error getting transfer history:", error.message);
            return [];
        }
    }
}

// Demo script
async function runDemo() {
    const networkType = process.argv[2] || "local";
    
    console.log("🎬 Starting Token Operations Demo");
    
    // Setup connection
    const setup = new ContractSetup();
    const connected = await setup.init(networkType);
    if (!connected) return;
    
    // Load contracts
    const addresses = DEFAULT_ADDRESSES[networkType] || DEFAULT_ADDRESSES.local;
    await setup.loadContracts(addresses);
    
    // Create token operations instance
    const tokenOps = new TokenOperations(setup);
    tokenOps.setContract("stableCoin");
    
    // Demo operations
    try {
        // Get token info
        await tokenOps.getTokenInfo();
        
        // Check current balance
        await tokenOps.checkBalance();
        
        // Create test addresses
        const testWallet = ethers.Wallet.createRandom();
        console.log("\n🧪 Created test wallet:", testWallet.address);
        
        // Transfer tokens to test wallet
        await tokenOps.transfer(testWallet.address, 100);
        
        // Check balances
        await tokenOps.checkMultipleBalances([
            await setup.signer.getAddress(),
            testWallet.address
        ]);
        
        // Demonstrate approval and transferFrom
        await tokenOps.approve(testWallet.address, 50);
        
        // Note: For transferFrom demo, we'd need the test wallet to have ETH for gas
        // This is just to show the function structure
        
        console.log("\n✅ Demo completed successfully!");
        
    } catch (error) {
        console.error("❌ Demo failed:", error.message);
    }
}

// Export for use in other scripts
module.exports = TokenOperations;

// Run demo if script is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}