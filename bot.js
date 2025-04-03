const { ethers } = require('ethers');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk'); // Gunakan chalk@4 agar kompatibel dengan require()

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function showBanner() {
    console.log(chalk.cyan(`
    ***********************************************
    ************ EVM Bulk Send v1.0.0 *************
    ***********************************************
    Created by github.com/lizkyyy
    ***********************************************
    `));
}

async function distributeEth(privateKeys, provider, addresses, amountPerAddress) {
    try {
        console.log(chalk.yellow('\n🔹 Starting direct transfer to target addresses...'));

        // Loop through each wallet and perform the transfers
        for (let i = 0; i < privateKeys.length; i++) {
            const wallet = new ethers.Wallet(privateKeys[i], provider);
            console.log(chalk.cyan(`Using wallet ${wallet.address} for direct transfers.`));

            // Iterate through target addresses
            for (let j = 0; j < addresses.length; j++) {
                try {
                    if (!ethers.isAddress(addresses[j])) {
                        console.log(chalk.red(`❌ Invalid address: ${addresses[j]}. Skipping...`));
                        continue;
                    }

                    const balance = await provider.getBalance(wallet.address);
                    const sendAmount = BigInt(ethers.parseEther(amountPerAddress.toString()));
                    const gasEstimate = BigInt(ethers.parseEther("0.0001")); // Estimasi gas fee kecil

                    if (balance < (sendAmount + gasEstimate)) {
                        console.log(chalk.red(`❌ Insufficient balance in ${wallet.address}. Skipping...`));
                        continue;
                    }

                    let gasLimit;
                    try {
                        gasLimit = await provider.estimateGas({
                            to: addresses[j],
                            value: sendAmount
                        });
                    } catch {
                        gasLimit = 21000; // Default gas limit for simple transfers
                    }

                    const tx = await wallet.sendTransaction({
                        to: addresses[j],
                        value: sendAmount,
                        gasLimit
                    });

                    console.log(chalk.green(`✅ Sent ${amountPerAddress} ETH from ${wallet.address} to ${addresses[j]}`));
                    console.log(chalk.gray(`🔗 Transaction hash: ${tx.hash}`));

                    await tx.wait(); // Wait for transaction to be mined
                } catch (error) {
                    console.log(chalk.red(`❌ Error sending to ${addresses[j]}: ${error.message}`));
                    continue;
                }
            }
        }

        console.log(chalk.green('\n✅ All direct transfers complete!'));

    } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error.message}`));
    }
}

async function main() {
    console.clear();
    showBanner();

    try {
        // Ask user for RPC URL
        const rpcUrl = await new Promise((resolve) => {
            rl.question(chalk.green('\n🔹 Enter RPC URL: '), resolve);
        });

        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Read private keys from wallet.txt
        const privateKeys = fs.readFileSync('wallet.txt', 'utf8')
            .split('\n')
            .map(key => key.trim())
            .filter(key => key.startsWith("0x") && key.length === 66);

        if (privateKeys.length === 0) {
            throw new Error('❌ No valid private keys found in wallet.txt');
        }

        console.log(chalk.cyan(`\n🔹 Found ${privateKeys.length} private keys`));

        // Check balance of each wallet
        for (let i = 0; i < privateKeys.length; i++) {
            const wallet = new ethers.Wallet(privateKeys[i], provider);
            const balance = await provider.getBalance(wallet.address);
            console.log(chalk.yellow(`Wallet ${i + 1} address: ${wallet.address}`));
            console.log(chalk.yellow(`Balance: ${ethers.formatEther(balance)} ETH`));
        }

        // Ask user for the amount to send
        const amountPerAddress = await new Promise((resolve) => {
            rl.question(chalk.green('\n🔹 Enter ETH amount to send to each address: '), resolve);
        });

        // Read target addresses from target_addresses.txt
        const addresses = fs.readFileSync('target_addresses.txt', 'utf8')
            .split('\n')
            .map(addr => addr.trim())
            .filter(addr => ethers.isAddress(addr));

        if (addresses.length === 0) {
            throw new Error('❌ No valid addresses found in target_addresses.txt');
        }

        console.log(chalk.cyan(`\n🔹 Found ${addresses.length} valid target addresses`));

        // Call the function to distribute ETH
        await distributeEth(privateKeys, provider, addresses, parseFloat(amountPerAddress));

    } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error.message}`));
    } finally {
        rl.close();
    }
}

main();
