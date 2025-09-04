const { ethers } = require("ethers");
const { ContractSetup, DEFAULT_ADDRESSES } = require("./setup.js");

/**
 * MultiSig wallet operations script
 * Demonstrates multi-signature wallet interactions
 */

class MultiSigOperations {
    constructor(setup) {
        this.setup = setup;
        this.contract = null;
    }

    // Initialize with MultiSig contract
    setContract(contractName = "multiSig") {
        if (!this.setup.contracts[contractName]) {
            throw new Error(`Contract ${contractName} not found`);
        }
        this.contract = this.setup.contracts[contractName];
        console.log(`🔐 Using ${contractName} contract`);
    }

    // Get MultiSig info
    async getMultiSigInfo() {
        console.log("\n🔐 MultiSig Information:");
        
        try {
            const owners = await this.contract.getOwners();
            const required = await this.contract.numConfirmationsRequired ? 
                await this.contract.numConfirmationsRequired() : 
                await this.contract.required();
            const txCount = await this.contract.getTransactionCount();
            const balance = await this.setup.provider.getBalance(await this.contract.getAddress());

            console.log("Owners:", owners.length);
            owners.forEach((owner, index) => {
                console.log(`  ${index + 1}. ${owner}`);
            });
            console.log("Required Confirmations:", required.toString());
            console.log("Total Transactions:", txCount.toString());
            console.log("Contract Balance:", ethers.formatEther(balance), "ETH");

            return {
                owners, required, txCount, balance
            };
        } catch (error) {
            console.error("❌ Error getting MultiSig info:", error.message);
            return null;
        }
    }

    // Check if address is owner
    async isOwner(address = null) {
        try {
            const checkAddress = address || await this.setup.signer.getAddress();
            const isOwner = await this.contract.isOwner(checkAddress);
            console.log(`🔍 ${checkAddress} is owner:`, isOwner ? "Yes" : "No");
            return isOwner;
        } catch (error) {
            console.error("❌ Error checking owner status:", error.message);
            return false;
        }
    }

    // Submit transaction
    async submitTransaction(to, value, data = "0x", options = {}) {
        console.log(`\n📝 Submitting transaction to ${to}...`);
        console.log(`Value: ${ethers.formatEther(value)} ETH`);
        console.log(`Data: ${data}`);
        
        try {
            const tx = await this.contract.submitTransaction(to, value, data, {
                gasLimit: options.gasLimit || 200000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Get the transaction index from events
            const txIndex = await this.getLatestTransactionIndex();
            console.log("📋 Transaction submitted with index:", txIndex);
            
            return { receipt, txIndex };
        } catch (error) {
            console.error("❌ Submit transaction failed:", error.message);
            return null;
        }
    }

    // Submit and confirm transaction in one call (if supported)
    async submitAndConfirmTransaction(to, value, data = "0x", options = {}) {
        console.log(`\n📝 Submitting and confirming transaction to ${to}...`);
        
        try {
            // Check if contract supports this function
            if (!this.contract.submitAndConfirmTransaction) {
                console.log("⚠️ Contract doesn't support submitAndConfirmTransaction, using separate calls");
                const result = await this.submitTransaction(to, value, data, options);
                if (result) {
                    await this.confirmTransaction(result.txIndex, options);
                }
                return result;
            }

            const tx = await this.contract.submitAndConfirmTransaction(to, value, data, {
                gasLimit: options.gasLimit || 250000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            const txIndex = await this.getLatestTransactionIndex();
            console.log("📋 Transaction submitted and confirmed with index:", txIndex);
            
            return { receipt, txIndex };
        } catch (error) {
            console.error("❌ Submit and confirm failed:", error.message);
            return null;
        }
    }

    // Confirm transaction
    async confirmTransaction(txIndex, options = {}) {
        console.log(`\n✅ Confirming transaction ${txIndex}...`);
        
        try {
            // Check if already confirmed by current signer
            const isConfirmed = await this.contract.isConfirmed(txIndex, await this.setup.signer.getAddress());
            if (isConfirmed) {
                console.log("⚠️ Transaction already confirmed by current signer");
                return null;
            }

            const tx = await this.contract.confirmTransaction(txIndex, {
                gasLimit: options.gasLimit || 100000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check confirmation status
            await this.getTransactionStatus(txIndex);
            
            return receipt;
        } catch (error) {
            console.error("❌ Confirm transaction failed:", error.message);
            return null;
        }
    }

    // Batch confirm transactions
    async batchConfirm(txIndexes, options = {}) {
        console.log(`\n✅ Batch confirming ${txIndexes.length} transactions...`);
        
        try {
            // Check if contract supports batch confirm
            if (!this.contract.batchConfirm) {
                console.log("⚠️ Contract doesn't support batch confirm, using individual confirmations");
                const results = [];
                for (const txIndex of txIndexes) {
                    const result = await this.confirmTransaction(txIndex, options);
                    results.push(result);
                }
                return results;
            }

            const tx = await this.contract.batchConfirm(txIndexes, {
                gasLimit: options.gasLimit || (100000 * txIndexes.length)
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check status of all transactions
            for (const txIndex of txIndexes) {
                await this.getTransactionStatus(txIndex);
            }
            
            return receipt;
        } catch (error) {
            console.error("❌ Batch confirm failed:", error.message);
            return null;
        }
    }

    // Execute transaction
    async executeTransaction(txIndex, options = {}) {
        console.log(`\n🚀 Executing transaction ${txIndex}...`);
        
        try {
            // Check if can be executed
            const status = await this.getTransactionStatus(txIndex, false);
            if (!status || !status.canExecute) {
                throw new Error("Transaction cannot be executed - insufficient confirmations or already executed");
            }

            const tx = await this.contract.executeTransaction(txIndex, {
                gasLimit: options.gasLimit || 300000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check final status
            await this.getTransactionStatus(txIndex);
            
            return receipt;
        } catch (error) {
            console.error("❌ Execute transaction failed:", error.message);
            return null;
        }
    }

    // Revoke confirmation
    async revokeConfirmation(txIndex, options = {}) {
        console.log(`\n❌ Revoking confirmation for transaction ${txIndex}...`);
        
        try {
            const tx = await this.contract.revokeConfirmation(txIndex, {
                gasLimit: options.gasLimit || 80000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new status
            await this.getTransactionStatus(txIndex);
            
            return receipt;
        } catch (error) {
            console.error("❌ Revoke confirmation failed:", error.message);
            return null;
        }
    }

    // Get transaction details
    async getTransaction(txIndex) {
        try {
            const transaction = await this.contract.getTransaction(txIndex);
            console.log(`\n📋 Transaction ${txIndex} Details:`);
            console.log("To:", transaction[0] || transaction.to);
            console.log("Value:", ethers.formatEther(transaction[1] || transaction.value), "ETH");
            console.log("Data:", transaction[2] || transaction.data);
            console.log("Executed:", transaction[3] || transaction.executed);
            console.log("Confirmations:", (transaction[4] || transaction.confirmations).toString());
            
            return transaction;
        } catch (error) {
            console.error("❌ Error getting transaction:", error.message);
            return null;
        }
    }

    // Get transaction status
    async getTransactionStatus(txIndex, log = true) {
        try {
            let status;
            
            // Try batch status function first
            if (this.contract.getTransactionStatus) {
                status = await this.contract.getTransactionStatus(txIndex);
            } else {
                // Fallback to individual calls
                const transaction = await this.contract.getTransaction(txIndex);
                const required = await this.contract.numConfirmationsRequired ? 
                    await this.contract.numConfirmationsRequired() : 
                    await this.contract.required();
                
                const confirmations = transaction[4] || transaction.confirmations;
                const executed = transaction[3] || transaction.executed;
                
                status = [executed, confirmations, !executed && confirmations >= required];
            }
            
            if (log) {
                console.log(`\n📊 Transaction ${txIndex} Status:`);
                console.log("Executed:", status[0] ? "Yes" : "No");
                console.log("Confirmations:", status[1].toString());
                console.log("Can Execute:", status[2] ? "Yes" : "No");
            }
            
            return {
                executed: status[0],
                confirmations: status[1],
                canExecute: status[2]
            };
        } catch (error) {
            console.error("❌ Error getting transaction status:", error.message);
            return null;
        }
    }

    // List all transactions
    async listTransactions(limit = 10) {
        console.log(`\n📜 Listing last ${limit} transactions:`);
        
        try {
            const txCount = await this.contract.getTransactionCount();
            const totalTxs = Number(txCount);
            
            const startIndex = Math.max(0, totalTxs - limit);
            
            for (let i = startIndex; i < totalTxs; i++) {
                console.log(`\n--- Transaction ${i} ---`);
                await this.getTransaction(i);
                await this.getTransactionStatus(i, false);
                
                const status = await this.getTransactionStatus(i, false);
                console.log("Status:", status.executed ? "✅ Executed" : 
                           status.canExecute ? "🚀 Ready to execute" : 
                           `⏳ Needs ${Number(await this.contract.numConfirmationsRequired ? await this.contract.numConfirmationsRequired() : await this.contract.required()) - Number(status.confirmations)} more confirmations`);
            }
            
            return totalTxs;
        } catch (error) {
            console.error("❌ Error listing transactions:", error.message);
            return 0;
        }
    }

    // Get confirmation status for transaction
    async getConfirmationStatus(txIndex) {
        console.log(`\n👥 Confirmation status for transaction ${txIndex}:`);
        
        try {
            const owners = await this.contract.getOwners();
            const confirmations = {};
            
            for (const owner of owners) {
                const confirmed = await this.contract.isConfirmed(txIndex, owner);
                confirmations[owner] = confirmed;
                console.log(`${owner}: ${confirmed ? "✅ Confirmed" : "❌ Not confirmed"}`);
            }
            
            return confirmations;
        } catch (error) {
            console.error("❌ Error getting confirmation status:", error.message);
            return {};
        }
    }

    // Helper function to get latest transaction index
    async getLatestTransactionIndex() {
        try {
            const txCount = await this.contract.getTransactionCount();
            return Number(txCount) - 1;
        } catch (error) {
            return 0;
        }
    }

    // Submit token transfer transaction
    async submitTokenTransfer(tokenAddress, to, amount, options = {}) {
        console.log(`\n🪙 Submitting token transfer transaction...`);
        console.log(`Token: ${tokenAddress}`);
        console.log(`To: ${to}`);
        console.log(`Amount: ${amount}`);
        
        try {
            // Create transfer function call data
            const tokenContract = new ethers.Contract(tokenAddress, [
                "function transfer(address to, uint256 amount) returns (bool)"
            ], this.setup.signer);
            
            const amountWei = ethers.parseEther(amount.toString());
            const data = tokenContract.interface.encodeFunctionData("transfer", [to, amountWei]);
            
            return await this.submitTransaction(tokenAddress, 0, data, options);
        } catch (error) {
            console.error("❌ Submit token transfer failed:", error.message);
            return null;
        }
    }

    // Deposit ETH to MultiSig
    async depositETH(amount, options = {}) {
        console.log(`\n💰 Depositing ${amount} ETH to MultiSig...`);
        
        try {
            const amountWei = ethers.parseEther(amount.toString());
            
            const tx = await this.setup.signer.sendTransaction({
                to: await this.contract.getAddress(),
                value: amountWei,
                gasLimit: options.gasLimit || 50000
            });
            
            const receipt = await this.setup.waitForTransaction(tx);
            this.setup.displayReceipt(receipt);
            
            // Check new balance
            const balance = await this.setup.provider.getBalance(await this.contract.getAddress());
            console.log("New MultiSig balance:", ethers.formatEther(balance), "ETH");
            
            return receipt;
        } catch (error) {
            console.error("❌ Deposit failed:", error.message);
            return null;
        }
    }
}

// Demo script
async function runDemo() {
    const networkType = process.argv[2] || "local";
    
    console.log("🎬 Starting MultiSig Operations Demo");
    
    // Setup connection
    const setup = new ContractSetup();
    const connected = await setup.init(networkType);
    if (!connected) return;
    
    // Load contracts
    const addresses = DEFAULT_ADDRESSES[networkType] || DEFAULT_ADDRESSES.local;
    await setup.loadContracts(addresses);
    
    // Create MultiSig operations instance
    const multiSigOps = new MultiSigOperations(setup);
    multiSigOps.setContract("multiSig");
    
    // Demo operations
    try {
        // Get MultiSig info
        await multiSigOps.getMultiSigInfo();
        
        // Check if current signer is owner
        await multiSigOps.isOwner();
        
        // List existing transactions
        await multiSigOps.listTransactions(5);
        
        // Demo: Submit a simple ETH transfer
        const testAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        const result = await multiSigOps.submitTransaction(testAddress, ethers.parseEther("0.1"));
        
        if (result) {
            // Show confirmation status
            await multiSigOps.getConfirmationStatus(result.txIndex);
            
            // If you have multiple signers, you could confirm here
            // await multiSigOps.confirmTransaction(result.txIndex);
        }
        
        console.log("\n✅ Demo completed successfully!");
        
    } catch (error) {
        console.error("❌ Demo failed:", error.message);
    }
}

// Export for use in other scripts
module.exports = MultiSigOperations;

// Run demo if script is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}