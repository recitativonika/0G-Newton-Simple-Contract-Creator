const { ethers } = require('ethers');
const fs = require('fs').promises;

async function getPrivateKeys() {
    try {
        const data = await fs.readFile('priv.txt', 'utf8');
        const privateKeys = data.split('\n').filter(key => key.trim() !== '');
        if (privateKeys.length === 0) {
            throw new Error("No private keys found in priv.txt");
        }
        return privateKeys.map(key => key.trim());
    } catch (error) {
        console.error("Error reading priv.txt:", error.message);
        process.exit(1);
    }
}

// Minimal contract: just a counter
const minimalBytecode = "0x608060405234801561001057600080fd5b5060bf8061001f6000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636d4ce63c14610059575b600080fd5b610043610075565b60405190815260200160405180910390f35b61006161007f565b604051908152602001610050565b60008054905090565b60005490565b600081905091905056fea2646970667358221220e5b8eabf0f6b6fddf88a0b5e7d7dabdde3fb7bade5fb2f7f7e7e7e7e7e7e7e7e64736f6c63430008140033";
const minimalAbi = [
    {"inputs":[],"name":"get","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"storedData","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

async function checkRpcHealth(provider) {
    try {
        const blockNumber = await provider.getBlockNumber();
        console.log("RPC Health Check - Current block number:", blockNumber);
        return true;
    } catch (error) {
        console.error("RPC Health Check Failed:", error.message);
        return false;
    }
}

async function deployWithWallet(privateKey, provider) {
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("\n----------------------------------------------");
    console.log("Deploying from address:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "A0GI");

    // Try deploying minimal contract with ContractFactory
    console.log("Attempting deployment with ContractFactory...");
    try {
        const factory = new ethers.ContractFactory(minimalAbi, minimalBytecode, wallet);
        const gasEstimate = await provider.estimateGas({
            from: wallet.address,
            data: minimalBytecode
        });
        console.log("Estimated gas:", gasEstimate.toString());

        const contract = await factory.deploy({
            gasLimit: ethers.toBigInt(gasEstimate) * 120n / 100n, // Fixed BigNumber arithmetic
            gasPrice: ethers.parseUnits("0.1", "gwei")
        });

        console.log("Transaction hash:", contract.deploymentTransaction().hash);

        // Return true immediately after getting the transaction hash
        return true;

    } catch (error) {
        console.error("ContractFactory deployment failed:", error);
    }

    // Fallback: Manual transaction deployment
    console.log("Attempting manual transaction deployment...");
    try {
        const tx = {
            from: wallet.address,
            data: minimalBytecode,
            gasLimit: 1000000,
            gasPrice: ethers.parseUnits("0.1", "gwei")
        };
        const txResponse = await wallet.sendTransaction(tx);
        console.log("Manual transaction hash:", txResponse.hash);

        // Return true immediately after getting the transaction hash
        return true;

    } catch (manualError) {
        console.error("Manual deployment failed:", manualError);
        return false; // Deployment failed
    }
}

async function main() {
    // Get all private keys
    const privateKeys = await getPrivateKeys();
    console.log(`Found ${privateKeys.length} private keys in priv.txt`);

    // Connect to 0G Newton Testnet
    const provider = new ethers.JsonRpcProvider("https://16600.rpc.thirdweb.com/");

    // Check RPC health
    console.log("Checking RPC health...");
    const rpcHealthy = await checkRpcHealth(provider);
    if (!rpcHealthy) {
        console.error("RPC appears to be down. Aborting deployment.");
        process.exit(1);
    }

    // Process each wallet sequentially
    for (let i = 0; i < privateKeys.length; i++) {
        console.log(`\nProcessing wallet ${i+1} of ${privateKeys.length}`);
        try {
            const success = await deployWithWallet(privateKeys[i], provider);
            if (success) {
                console.log(`Transaction sent for wallet ${i+1}. Moving to next wallet.`);
            } else {
                console.log(`Deployment failed for wallet ${i+1}. Moving to next wallet.`);
            }
        } catch (error) {
            console.error(`Error processing wallet ${i+1}:`, error);
            console.log("Moving to next wallet.");
        }
    }

    console.log("\nAll wallets processed.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });